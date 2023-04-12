import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { AddressZero } from "@ethersproject/constants"
import { expect } from './utils/setup'
import { NON_ZERO_ADDRESS } from './utils/constants'
import { deployFromName } from './utils/contracts'

const ERROR_STRINGS = {
  ALREADY_INITIALIZED: 'Contract has already been initialized.',
  INVALID_MINTER: 'not authorized to mint',
  INVALID_BURNER: 'not authorized to burn',
  INVALID_REBASER: 'not authorized to rebase',
  INVALID_TOKEN_ROLE_ADMIN: 'not authorized to edit roles',
}

describe('L2ECO tests', () => {

  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let l2BridgeImpersonator: SignerWithAddress
  before(async () => {
    ;[alice, bob, l2BridgeImpersonator] = await ethers.getSigners()
  })

  let L2ECO: Contract
  beforeEach(async () => {

    // Deploy an L2 ERC20
    L2ECO = await deployFromName('L2ECO', {
      args: [
        bob.address,
      ],
    })

    await L2ECO.initialize(AddressZero, l2BridgeImpersonator.address, l2BridgeImpersonator.address)
  })

  // test initialize reverting
  describe('initialize', () => {
    it('Should only be callable once', async () => {
      await expect(
        L2ECO.initialize(
          AddressZero,
          NON_ZERO_ADDRESS, // this is cuz a zero address could trigger a different revert
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith(ERROR_STRINGS.ALREADY_INITIALIZED)
    })
  })

  describe('minting', () => {
    const mintAmount = 1000

    it('reverts if unauthed', async () => {
      await expect(
        L2ECO.connect(alice).mint(alice.address, mintAmount)
      ).to.be.revertedWith(ERROR_STRINGS.INVALID_MINTER)
    })
    
    it('increases balance', async () => {
      expect((await L2ECO.balanceOf(alice.address)) == 0).to.be.true
      await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, mintAmount)
      expect((await L2ECO.balanceOf(alice.address)) == mintAmount).to.be.true
    })
  })

  describe('burning', () => {
    const burnAmount = 1000

    it('reverts if unauthed', async () => {
      await expect(
        L2ECO.connect(bob).burn(alice.address, burnAmount)
      ).to.be.revertedWith(ERROR_STRINGS.INVALID_BURNER)
    })
    
    describe('decreases balance', () => {
      beforeEach(async () => {
        await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, burnAmount)
        expect((await L2ECO.balanceOf(alice.address)) == burnAmount).to.be.true
      })

      it('on self call', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == burnAmount).to.be.true
        await L2ECO.connect(alice).burn(alice.address, burnAmount)
        expect((await L2ECO.balanceOf(alice.address)) == 0).to.be.true
      })

      it('on admin call', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == burnAmount).to.be.true
        await L2ECO.connect(l2BridgeImpersonator).burn(alice.address, burnAmount)
        expect((await L2ECO.balanceOf(alice.address)) == 0).to.be.true
      })
    })
  })

  describe('rebasing', () => {
    const newInflationMult = ethers.utils.parseEther('.5')
    

    it('reverts if unauthed', async () => {
      await expect(
        L2ECO.connect(bob).rebase(newInflationMult)
      ).to.be.revertedWith(ERROR_STRINGS.INVALID_REBASER)
    })

    describe('on rebase', () => {
      const aliceBalance = 1000

      beforeEach(async () => {
        await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, aliceBalance)
        expect((await L2ECO.balanceOf(alice.address)) == aliceBalance).to.be.true
      })

      it('emits an event', async () => {
        await expect(
          L2ECO.connect(l2BridgeImpersonator).rebase(newInflationMult)
        ).to.emit(L2ECO, 'NewInflationMultiplier').withArgs(newInflationMult)
      })

      it('changes balance', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == aliceBalance).to.be.true

        await L2ECO.connect(l2BridgeImpersonator).rebase(newInflationMult)

        expect((await L2ECO.balanceOf(alice.address)) == 2*aliceBalance).to.be.true
      })
    })
  })

  describe('transfers', () => {
    const initialAliceBalance = 1000

    beforeEach(async () => {
      await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, initialAliceBalance)
      expect((await L2ECO.balanceOf(alice.address)) == initialAliceBalance).to.be.true
    })

    it('emits base value event', async () => {
      await expect(
        L2ECO.connect(alice).transfer(bob.address, initialAliceBalance)
      ).to.emit(L2ECO, 'BaseValueTransfer').withArgs(
        alice.address,
        bob.address,
        ethers.utils.parseEther('1000')
      )
    })
  })

  // test role logic
  describe('role management', () => {
    describe('reverts', () => {
      it('reverts on unauthed minter change', async () => {
        await expect(
          L2ECO.updateMinters(alice.address, true)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_TOKEN_ROLE_ADMIN)
      })
      
      it('reverts on unauthed burner change', async () => {
        await expect(
          L2ECO.updateBurners(alice.address, true)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_TOKEN_ROLE_ADMIN)
      })

      it('reverts on unauthed rebaser change', async () => {
        await expect(
          L2ECO.updateRebasers(alice.address, true)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_TOKEN_ROLE_ADMIN)
      })

      it('reverts on unauthed role admin change', async () => {
        await expect(
          L2ECO.updateTokenRoleAdmin(alice.address)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_TOKEN_ROLE_ADMIN)
      })
    })

    describe('minting', () => {
      const mintAmount = 1000

      it('can add permission', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == 0).to.be.true

        await expect(
          L2ECO.connect(alice).mint(alice.address, mintAmount)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_MINTER)

        await L2ECO.connect(l2BridgeImpersonator).updateMinters(alice.address, true)

        await L2ECO.connect(alice).mint(alice.address, mintAmount)
        expect((await L2ECO.balanceOf(alice.address)) == mintAmount).to.be.true
      })

      it('can remove permission', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == 0).to.be.true
        await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, mintAmount)
        expect((await L2ECO.balanceOf(alice.address)) == mintAmount).to.be.true

        await L2ECO.connect(l2BridgeImpersonator).updateMinters(l2BridgeImpersonator.address, false)

        await expect(
          L2ECO.connect(l2BridgeImpersonator).mint(alice.address, mintAmount)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_MINTER)
      })
    })

    describe('burning', () => {
      const burnAmount = 1000

      beforeEach(async () => {
        await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, burnAmount)
        expect((await L2ECO.balanceOf(alice.address)) == burnAmount).to.be.true
      })

      it('can add permission', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == burnAmount).to.be.true

        await expect(
          L2ECO.connect(bob).burn(alice.address, burnAmount)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_BURNER)

        await L2ECO.connect(l2BridgeImpersonator).updateBurners(bob.address, true)

        await L2ECO.connect(bob).burn(alice.address, burnAmount)
        expect((await L2ECO.balanceOf(alice.address)) == 0).to.be.true
      })

      it('can remove permission', async () => {
        await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, burnAmount)
        expect((await L2ECO.balanceOf(alice.address)) == 2*burnAmount).to.be.true
        await L2ECO.connect(l2BridgeImpersonator).burn(alice.address, burnAmount)
        expect((await L2ECO.balanceOf(alice.address)) == burnAmount).to.be.true

        await L2ECO.connect(l2BridgeImpersonator).updateBurners(l2BridgeImpersonator.address, false)

        await expect(
          L2ECO.connect(l2BridgeImpersonator).burn(alice.address, burnAmount)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_BURNER)
      })
    })

    describe('rebasing', () => {
      const newInflationMult = ethers.utils.parseEther('.5')
      const aliceBalance = 1000

      beforeEach(async () => {
        await L2ECO.connect(l2BridgeImpersonator).mint(alice.address, aliceBalance)
        expect((await L2ECO.balanceOf(alice.address)) == aliceBalance).to.be.true
      })

      it('can add permission', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == aliceBalance).to.be.true

        await expect(
          L2ECO.connect(alice).rebase(newInflationMult)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_REBASER)

        await L2ECO.connect(l2BridgeImpersonator).updateRebasers(alice.address, true)

        await L2ECO.connect(alice).rebase(newInflationMult)
        expect((await L2ECO.balanceOf(alice.address)) == 2*aliceBalance).to.be.true
      })

      it('can remove permission', async () => {
        expect((await L2ECO.balanceOf(alice.address)) == aliceBalance).to.be.true
        await L2ECO.connect(l2BridgeImpersonator).rebase(newInflationMult)
        expect((await L2ECO.balanceOf(alice.address)) == 2*aliceBalance).to.be.true
        
        await L2ECO.connect(l2BridgeImpersonator).updateRebasers(l2BridgeImpersonator.address, false)

        await expect(
          L2ECO.connect(l2BridgeImpersonator).rebase(newInflationMult)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_REBASER)
      })
    })

    describe('admin', () => {
      it('can change admin', async () => {
        // can edit roles
        await L2ECO.connect(l2BridgeImpersonator).updateMinters(alice.address, true)

        await L2ECO.connect(l2BridgeImpersonator).updateTokenRoleAdmin(alice.address)

        // can no longer edit roles
        await expect(
          L2ECO.connect(l2BridgeImpersonator).updateMinters(alice.address, false)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_TOKEN_ROLE_ADMIN)
      })
    })
  })
})