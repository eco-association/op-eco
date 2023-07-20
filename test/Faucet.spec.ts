import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { AddressZero } from '@ethersproject/constants'
import { expect } from './utils/setup'
import { NON_ZERO_ADDRESS } from './utils/constants'
import { ERROR_STRINGS } from './utils/errors'
import { L2ECO } from '../typechain-types/contracts/token/L2ECO'
import { Faucet } from'../typechain-types/contracts/token/Faucet'

describe('L2ECO tests', () => {
    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let charlie: SignerWithAddress
    let dave: SignerWithAddress
    let l2BridgeImpersonator: SignerWithAddress
    let eco: L2ECO
    let faucet: Faucet

    const drip_amount: number = 1000

    const hash1: any = ethers.utils.keccak256('0xdeadbeef')
    const hash2 = ethers.utils.keccak256('0xbadf00d1')
  
    const baseInflationMult = 10
  
    beforeEach(async () => {
      ;[alice, bob, charlie, dave, l2BridgeImpersonator] = await ethers.getSigners()
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
      faucet = await faucetFactory.deploy(eco.address, drip_amount, alice.address, [bob.address, charlie.address])

      await eco.connect(l2BridgeImpersonator).mint(faucet.address, 5*drip_amount)
    })

    describe('constructor', async () => {
        it('sets correctly', async () => {
            expect(await faucet.ECO()).to.eq(eco.address)
            expect(await faucet.DRIP_AMOUNT()).to.eq(drip_amount)
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
                faucet.connect(dave).drip(hash1, dave.address)
            ).to.be.revertedWith("Not approved operator")
        })
        it('allows approved operators to use drip, but cannot drip to the same socialID hash more than once', async () => {
            expect(await eco.balanceOf(alice.address)).to.eq(0)
            expect(await eco.balanceOf(faucet.address)).to.eq(5*drip_amount)

            await expect(
                faucet.connect(alice).drip(hash1, alice.address)
            )
                .to.emit(faucet, 'FaucetDripped')
                .withArgs(alice.address)
            expect(await eco.balanceOf(alice.address)).to.eq(drip_amount)
            expect(await eco.balanceOf(faucet.address)).to.eq(4*drip_amount)

            await expect(
                faucet.connect(alice).drip(hash1, alice.address)
            ).to.be.revertedWith("the owner of this social ID has already minted.")

            expect(await eco.balanceOf(alice.address)).to.eq(drip_amount)
            expect(await eco.balanceOf(faucet.address)).to.eq(4*drip_amount)

            // should allow different socialID hash but same recipient address
            await faucet.connect(alice).drip(hash2, alice.address)
            expect(await eco.balanceOf(alice.address)).to.eq(2*drip_amount)
            expect(await eco.balanceOf(faucet.address)).to.eq(3*drip_amount)
        })
    })

    describe('drain', async () => {
        it('only allows superOperators to drain', async () => {
            expect(await eco.balanceOf(faucet.address)).to.eq(5*drip_amount)
            expect(await eco.balanceOf(alice.address)).to.eq(0)

            await expect(
                faucet.connect(bob).drain(bob.address)
            ).to.be.revertedWith("Not super operator")

            await expect(
                faucet.connect(alice).drain(alice.address)
            )
                .to.emit(faucet, 'FaucetDrained')
                .withArgs(alice.address)
            expect(await eco.balanceOf(faucet.address)).to.eq(0)
            expect(await eco.balanceOf(alice.address)).to.eq(5*drip_amount)
        })
    })

    describe('updating things', async () => {
        it("doesn't work if you're not a superOperator", async () => {
            await expect(
                faucet.connect(bob).updateApprovedOperator(bob.address, false)
            ).to.be.revertedWith("Not super operator")

            await expect(
                faucet.connect(charlie).updateSuperOperator(charlie.address, true)
            ).to.be.revertedWith("Not super operator")
            const newDripAmount = 1001
            await expect(
                faucet.connect(charlie).updateDripAmount(newDripAmount)
            ).to.be.revertedWith("Not super operator")

            expect(await faucet.approvedOperators(bob.address)).to.be.true
            expect(await faucet.superOperators(charlie.address)).to.be.false
            expect(await faucet.DRIP_AMOUNT()).to.not.eq(newDripAmount)
        })

        it('updates approvedOperators', async() => {
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

        it('updates superOperators', async() => {
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
            const newDripAmount = 1001
            expect(await faucet.DRIP_AMOUNT()).to.eq(drip_amount)

            await expect(
                faucet.connect(alice).updateDripAmount(newDripAmount)
            )
                .to.emit(faucet, 'DripAmountUpdated')
                .withArgs(newDripAmount)

            expect(await faucet.DRIP_AMOUNT()).to.eq(newDripAmount)
        })
    })
})