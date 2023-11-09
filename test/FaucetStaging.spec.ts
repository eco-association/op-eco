import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { AddressZero } from '@ethersproject/constants'
import { expect } from './utils/setup'
import { L2ECO } from '../typechain-types/contracts/token/L2ECO'
import { FaucetStaging } from '../typechain-types/contracts/token/FaucetStaging'

describe('FaucetStaging tests', () => {
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let charlie: SignerWithAddress
  let l2BridgeImpersonator: SignerWithAddress
  let eco: L2ECO
  let faucet: FaucetStaging

  const DRIP_UNVERIFIED: number = 30
  const DRIP_VERIFIED: number = 650
  const hash1: any = ethers.utils.keccak256('0xdeadbeef')

  const baseInflationMult = 10

  beforeEach(async () => {
    ;[alice, bob, charlie, l2BridgeImpersonator] = await ethers.getSigners()
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

    const faucetFactory = await ethers.getContractFactory('FaucetStaging')

    faucet = await faucetFactory.deploy(
      eco.address,
      DRIP_UNVERIFIED,
      DRIP_VERIFIED,
      alice.address,
      [bob.address, charlie.address]
    )

    await eco
      .connect(l2BridgeImpersonator)
      .mint(faucet.address, 5 * DRIP_VERIFIED)
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
    it('should reject multiple drips to the same user id hash', async () => {
      await expect(faucet.connect(bob).drip(hash1, alice.address, true))
        .to.emit(faucet, 'FaucetDripped')
        .withArgs(alice.address)
      expect(await eco.balanceOf(alice.address)).to.eq(DRIP_VERIFIED)

      await expect(
        faucet.connect(bob).drip(hash1, alice.address, true)
      ).to.be.revertedWith('the owner of this social ID has already minted.')
      expect(await eco.balanceOf(alice.address)).to.eq(DRIP_VERIFIED)
    })

    it('should allow multiple drips to the same user id hash when multiDrip is enabled', async () => {
      await expect(faucet.connect(bob).drip(hash1, alice.address, true))
        .to.emit(faucet, 'FaucetDripped')
        .withArgs(alice.address)
      expect(await eco.balanceOf(alice.address)).to.eq(DRIP_VERIFIED)

      const multiDripEnabled = true
      expect(await faucet.isMultiDrip()).to.eq(false)
      await expect(faucet.connect(alice).updateMultiDrip(multiDripEnabled))
        .to.emit(faucet, 'MultiDripUpdated')
        .withArgs(multiDripEnabled)
      expect(await faucet.isMultiDrip()).to.eq(multiDripEnabled)

      await expect(faucet.connect(bob).drip(hash1, alice.address, true))
        .to.emit(faucet, 'FaucetDripped')
        .withArgs(alice.address)
      expect(await eco.balanceOf(alice.address)).to.eq(DRIP_VERIFIED * 2)

      // check if we disable again
      await faucet.connect(alice).updateMultiDrip(false)

      await expect(
        faucet.connect(bob).drip(hash1, alice.address, true)
      ).to.be.revertedWith('the owner of this social ID has already minted.')
      expect(await eco.balanceOf(alice.address)).to.eq(DRIP_VERIFIED * 2)
    })
  })

  describe('updating things', async () => {
    it('should gate updating multi drip setting to super oparators', async () => {
      expect(await faucet.isMultiDrip()).to.eq(false)
      const multiDripEnabled = true

      await expect(
        faucet.connect(bob).updateMultiDrip(multiDripEnabled)
      ).to.be.revertedWith('Not super operator')
      expect(await faucet.isMultiDrip()).to.eq(false)

      await expect(faucet.connect(alice).updateMultiDrip(multiDripEnabled))
        .to.emit(faucet, 'MultiDripUpdated')
        .withArgs(multiDripEnabled)
      expect(await faucet.isMultiDrip()).to.eq(multiDripEnabled)
    })
  })
})
