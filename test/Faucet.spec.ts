import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { AddressZero } from '@ethersproject/constants'
import { expect } from './utils/setup'
import { L2ECO } from '../typechain-types/contracts/token/L2ECO'
import { Faucet } from '../typechain-types/contracts/token/Faucet'
import { ERROR_STRINGS } from './utils/errors'
import { Address } from '@eth-optimism/core-utils'

describe('L2ECO tests', () => {
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let charlie: SignerWithAddress
  let dave: SignerWithAddress
  let evan: SignerWithAddress
  let l2BridgeImpersonator: SignerWithAddress
  let eco: L2ECO
  let faucet: Faucet

  const DRIP_UNVERIFIED: number = 30
  const DRIP_VERIFIED: number = 650
  const EVAN_START_BALANCE: number = 1_000_000
  const hash1: any = ethers.utils.keccak256('0xdeadbeef')
  const hash2 = ethers.utils.keccak256('0xbadf00d1')

  const baseInflationMult = 10

  beforeEach(async () => {
    ;[alice, bob, charlie, dave, evan, l2BridgeImpersonator] =
      await ethers.getSigners()
    const ecoFactory = await ethers.getContractFactory('L2ECO')
    eco = (await upgrades.deployProxy(
      ecoFactory,
      [AddressZero, l2BridgeImpersonator.address],
      {
        initializer: 'initialize',
      }
    )) as L2ECO
    await eco.deployed()
    // set rebase to 10 so our numbers arent crazy big
    await eco.connect(l2BridgeImpersonator).rebase(baseInflationMult)

    const faucetFactory = await ethers.getContractFactory('Faucet')
    //   console.log(faucetFactory)
    faucet = await faucetFactory.deploy(
      eco.address,
      DRIP_UNVERIFIED,
      DRIP_VERIFIED,
      alice.address,
      [bob.address, charlie.address, evan.address]
    )

    await eco
      .connect(l2BridgeImpersonator)
      .mint(faucet.address, 5 * DRIP_VERIFIED)

    await eco
      .connect(l2BridgeImpersonator)
      .mint(evan.address, EVAN_START_BALANCE)
  })

  describe('constructor', async () => {
    it('sets correctly', async () => {
      expect(await faucet.ECO()).to.eq(eco.address)
      expect(await faucet.DRIP_UNVERIFIED()).to.eq(DRIP_UNVERIFIED)
      expect(await faucet.DRIP_VERIFIED()).to.eq(DRIP_VERIFIED)
      expect(await faucet.superOperators(alice.address)).to.be.true
      expect(await faucet.superOperators(bob.address)).to.be.false
      expect(await faucet.approvedOperators(alice.address)).to.be.false
      expect(await faucet.approvedOperators(bob.address)).to.be.true
      expect(await faucet.approvedOperators(charlie.address)).to.be.true
    })
  })

  describe('lets test the drip! (drip drip)', async () => {
    it('doesnt allow non-approved operators to use drip', async () => {
      await expect(
        faucet.connect(dave).drip(hash1, dave.address, true)
      ).to.be.revertedWith('Not approved operator')
    })
    it('allows approved operators to use drip, but cannot drip to the same socialID hash more than once', async () => {
      expect(await eco.balanceOf(alice.address)).to.eq(0)
      expect(await eco.balanceOf(faucet.address)).to.eq(5 * DRIP_VERIFIED)

      await expect(faucet.connect(alice).drip(hash1, alice.address, true))
        .to.emit(faucet, 'FaucetDripped')
        .withArgs(alice.address)
      expect(await eco.balanceOf(alice.address)).to.eq(DRIP_VERIFIED)
      expect(await eco.balanceOf(faucet.address)).to.eq(4 * DRIP_VERIFIED)

      await expect(
        faucet.connect(alice).drip(hash1, alice.address, true)
      ).to.be.revertedWith('the owner of this social ID has already minted.')

      expect(await eco.balanceOf(alice.address)).to.eq(DRIP_VERIFIED)
      expect(await eco.balanceOf(faucet.address)).to.eq(4 * DRIP_VERIFIED)

      // should allow different socialID hash but same recipient address
      //
      await faucet.connect(alice).drip(hash2, alice.address, false)
      expect(await eco.balanceOf(alice.address)).to.eq(
        DRIP_VERIFIED + DRIP_UNVERIFIED
      )
      expect(await eco.balanceOf(faucet.address)).to.eq(
        4 * DRIP_VERIFIED - DRIP_UNVERIFIED
      )
    })
  })

  describe('batchDrip', async () => {
    beforeEach(async () => {
      // clear tokens that the contract is given in initial setup so we can test it failing
      await faucet.drain(alice.address)
      expect(await eco.balanceOf(faucet.address)).to.be.equal(0)
    })

    it('should not allow non-approved operators to use batch drip', async () => {
      await expect(
        faucet.connect(dave).batchDrip(eco.address, [], [], 0)
      ).to.be.revertedWith(ERROR_STRINGS.FAUCET.INVALID_OPERATOR)
    })

    it("should revert if the addresses and amounts arrays aren't the same size", async () => {
      await expect(
        faucet.connect(evan).batchDrip(eco.address, [], [1], 0)
      ).to.be.revertedWith(ERROR_STRINGS.FAUCET.INVALID_PARAM_SIZE)
    })

    it('should revert if the total tokens for the call cannot be transfered to the faucet contract', async () => {
      await expect(
        faucet.connect(evan).batchDrip(eco.address, [bob.address], [1], 1)
      ).to.be.revertedWith(ERROR_STRINGS.FAUCET.INVALID_ALLOWANCE)
    })

    it('should revert if there are not enough tokens to transfer to all the recipients', async () => {
      const totalAmount = 10
      const overdrip = totalAmount + 5
      await eco.connect(evan).approve(faucet.address, totalAmount)
      expect(await eco.balanceOf(bob.address)).to.be.equal(0)
      await expect(
        faucet
          .connect(evan)
          .batchDrip(eco.address, [bob.address], [overdrip], totalAmount)
      ).to.be.revertedWith(ERROR_STRINGS.FAUCET.FAILED_TRANSFER)
      expect(await eco.balanceOf(bob.address)).to.be.equal(0)
    })

    it('should succeed and emit the BatchDrip event', async () => {
      const addresses: Address[] = []
      const amounts: number[] = []
      const accounts = 600
      const amount = 2
      Array(accounts)
        .fill(0)
        .forEach(() => {
          addresses.push(bob.address)
          amounts.push(amount)
        })
      await eco.connect(evan).approve(faucet.address, accounts * amount)

      await expect(
        faucet
          .connect(evan)
          .batchDrip(eco.address, addresses, amounts, accounts * amount)
      )
        .to.emit(faucet, 'BatchDrip')
        .withArgs(accounts, accounts * amount)
      expect(await eco.balanceOf(bob.address)).to.be.equal(accounts * amount)
    })
  })

  describe('drain', async () => {
    it('only allows superOperators to drain', async () => {
      expect(await eco.balanceOf(faucet.address)).to.eq(5 * DRIP_VERIFIED)
      expect(await eco.balanceOf(alice.address)).to.eq(0)

      await expect(faucet.connect(bob).drain(bob.address)).to.be.revertedWith(
        'Not super operator'
      )

      await expect(faucet.connect(alice).drain(alice.address))
        .to.emit(faucet, 'FaucetDrained')
        .withArgs(alice.address)
      expect(await eco.balanceOf(faucet.address)).to.eq(0)
      expect(await eco.balanceOf(alice.address)).to.eq(5 * DRIP_VERIFIED)
    })
  })

  describe('updating things', async () => {
    it("doesn't work if you're not a superOperator", async () => {
      await expect(
        faucet.connect(bob).updateApprovedOperator(bob.address, false)
      ).to.be.revertedWith('Not super operator')

      await expect(
        faucet.connect(charlie).updateSuperOperator(charlie.address, true)
      ).to.be.revertedWith('Not super operator')
      const newUnverifiedDrip = 50
      const newVerifiedDrip = 900
      await expect(
        faucet
          .connect(charlie)
          .updateDripAmount(newUnverifiedDrip, newVerifiedDrip)
      ).to.be.revertedWith('Not super operator')

      expect(await faucet.approvedOperators(bob.address)).to.be.true
      expect(await faucet.superOperators(charlie.address)).to.be.false
      expect(await faucet.DRIP_UNVERIFIED()).to.not.eq(newUnverifiedDrip)
      expect(await faucet.DRIP_VERIFIED()).to.not.eq(newVerifiedDrip)
    })

    it('updates approvedOperators', async () => {
      expect(await faucet.approvedOperators(dave.address)).to.be.false
      expect(await faucet.approvedOperators(bob.address)).to.be.true

      await expect(
        faucet.connect(alice).updateApprovedOperator(dave.address, true)
      )
        .to.emit(faucet, 'OperatorUpdated')
        .withArgs(dave.address, true)
      await faucet.connect(alice).updateApprovedOperator(bob.address, false)

      expect(await faucet.approvedOperators(dave.address)).to.be.true
      expect(await faucet.approvedOperators(bob.address)).to.be.false
    })

    it('updates superOperators', async () => {
      expect(await faucet.superOperators(dave.address)).to.be.false
      expect(await faucet.superOperators(alice.address)).to.be.true

      await expect(
        faucet.connect(alice).updateSuperOperator(dave.address, true)
      )
        .to.emit(faucet, 'SuperOperatorUpdated')
        .withArgs(dave.address, true)
      await faucet.connect(alice).updateSuperOperator(alice.address, false)

      expect(await faucet.superOperators(dave.address)).to.be.true
      expect(await faucet.superOperators(alice.address)).to.be.false
    })

    it('updates drip amount', async () => {
      const newUnverifiedDrip = 50
      const newVerifiedDrip = 900
      expect(await faucet.DRIP_UNVERIFIED()).to.eq(DRIP_UNVERIFIED)
      expect(await faucet.DRIP_VERIFIED()).to.eq(DRIP_VERIFIED)

      await expect(
        faucet
          .connect(alice)
          .updateDripAmount(newUnverifiedDrip, newVerifiedDrip)
      )
        .to.emit(faucet, 'DripAmountsUpdated')
        .withArgs(newUnverifiedDrip, newVerifiedDrip)

      expect(await faucet.DRIP_UNVERIFIED()).to.eq(newUnverifiedDrip)
      expect(await faucet.DRIP_VERIFIED()).to.eq(newVerifiedDrip)
    })
  })
})
