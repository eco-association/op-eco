import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { AddressZero } from '@ethersproject/constants'
import { expect } from './utils/setup'
import { NON_ZERO_ADDRESS } from './utils/constants'
import { ERROR_STRINGS } from './utils/errors'
import { L2ERC20MintableTest } from '../typechain-types'

describe('L2ERC20Mintable tests', () => {
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let l2BridgeImpersonator: SignerWithAddress
  let l2token: L2ERC20MintableTest

  beforeEach(async () => {
    ;[alice, bob, l2BridgeImpersonator] = await ethers.getSigners()
    const mintableFactory = await ethers.getContractFactory(
      'L2ERC20MintableTest'
    )
    l2token = (await upgrades.deployProxy(
      mintableFactory,
      [AddressZero, l2BridgeImpersonator.address],
      {
        initializer: 'initialize',
      }
    )) as L2ERC20MintableTest
    await l2token.deployed()
  })

  // test initialize reverting
  describe('initialize', () => {
    it('Should only be callable once', async () => {
      await expect(
        l2token.initialize(AddressZero, NON_ZERO_ADDRESS)
      ).to.be.revertedWith(ERROR_STRINGS.UPGRADES.ALREADY_INITIALIZED)
    })
  })

  describe('optimism standards', () => {
    it('should return the correct interface support', async () => {
      // ERC165
      expect(await l2token.supportsInterface('0x01ffc9a7')).to.be.true

      // L2StandardERC20
      expect(await l2token.supportsInterface('0x1d1d8b63')).to.be.true

      expect(await l2token.supportsInterface('0xffffffff')).to.be.false
    })
  })

  describe('minting', () => {
    const mintAmount = 1000

    it('reverts if unauthed', async () => {
      await expect(
        l2token.connect(alice).mint(alice.address, mintAmount)
      ).to.be.revertedWith(ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_MINTER)
    })

    it('increases balance', async () => {
      expect(await l2token.balanceOf(alice.address)).to.equal(0)
      await expect(
        l2token.connect(l2BridgeImpersonator).mint(alice.address, mintAmount)
      )
        .to.emit(l2token, 'Transfer')
        .withArgs(AddressZero, alice.address, mintAmount)

      expect(await l2token.balanceOf(alice.address)).to.equal(mintAmount)
    })
  })

  describe('burning', () => {
    const burnAmount = 1000

    it('reverts if unauthed', async () => {
      await expect(
        l2token.connect(bob).burn(alice.address, burnAmount)
      ).to.be.revertedWith(ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_BURNER)
    })

    describe('decreases balance', () => {
      beforeEach(async () => {
        await l2token
          .connect(l2BridgeImpersonator)
          .mint(alice.address, burnAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(burnAmount)
      })

      it('on self call', async () => {
        await l2token.connect(alice).burn(alice.address, burnAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(0)
      })

      it('on admin call', async () => {
        await l2token
          .connect(l2BridgeImpersonator)
          .burn(alice.address, burnAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(0)
      })
    })
  })

  // test role logic
  describe('role management', () => {
    describe('reverts', () => {
      it('reverts on unauthed minter change', async () => {
        await expect(
          l2token.updateMinters(alice.address, true)
        ).to.be.revertedWith(
          ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_TOKEN_ROLE_ADMIN
        )
      })

      it('reverts on unauthed burner change', async () => {
        await expect(
          l2token.updateBurners(alice.address, true)
        ).to.be.revertedWith(
          ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_TOKEN_ROLE_ADMIN
        )
      })

      it('reverts on unauthed role admin change', async () => {
        await expect(
          l2token.updateTokenRoleAdmin(alice.address)
        ).to.be.revertedWith(
          ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_TOKEN_ROLE_ADMIN
        )
      })
    })

    describe('minting', () => {
      const mintAmount = 1000

      it('can add permission', async () => {
        expect(await l2token.balanceOf(alice.address)).to.eq(0)

        await expect(
          l2token.connect(alice).mint(alice.address, mintAmount)
        ).to.be.revertedWith(ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_MINTER)

        await l2token
          .connect(l2BridgeImpersonator)
          .updateMinters(alice.address, true)

        await l2token.connect(alice).mint(alice.address, mintAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(mintAmount)
      })

      it('can remove permission', async () => {
        expect(await l2token.balanceOf(alice.address)).to.eq(0)
        await l2token
          .connect(l2BridgeImpersonator)
          .mint(alice.address, mintAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(mintAmount)

        await l2token
          .connect(l2BridgeImpersonator)
          .updateMinters(l2BridgeImpersonator.address, false)

        await expect(
          l2token.connect(l2BridgeImpersonator).mint(alice.address, mintAmount)
        ).to.be.revertedWith(ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_MINTER)
      })
    })

    describe('burning', () => {
      const burnAmount = 1000

      beforeEach(async () => {
        await l2token
          .connect(l2BridgeImpersonator)
          .mint(alice.address, burnAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(burnAmount)
      })

      it('can add permission', async () => {
        await expect(
          l2token.connect(bob).burn(alice.address, burnAmount)
        ).to.be.revertedWith(ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_BURNER)

        await l2token
          .connect(l2BridgeImpersonator)
          .updateBurners(bob.address, true)

        await l2token.connect(bob).burn(alice.address, burnAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(0)
      })

      it('can remove permission', async () => {
        await l2token
          .connect(l2BridgeImpersonator)
          .mint(alice.address, burnAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(2 * burnAmount)
        await l2token
          .connect(l2BridgeImpersonator)
          .burn(alice.address, burnAmount)
        expect(await l2token.balanceOf(alice.address)).to.eq(burnAmount)

        await l2token
          .connect(l2BridgeImpersonator)
          .updateBurners(l2BridgeImpersonator.address, false)

        await expect(
          l2token.connect(l2BridgeImpersonator).burn(alice.address, burnAmount)
        ).to.be.revertedWith(ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_BURNER)
      })
    })

    describe('admin', () => {
      it('can change admin', async () => {
        // can edit roles
        await l2token
          .connect(l2BridgeImpersonator)
          .updateMinters(alice.address, true)

        await l2token
          .connect(l2BridgeImpersonator)
          .updateTokenRoleAdmin(alice.address)

        // can no longer edit roles
        await expect(
          l2token
            .connect(l2BridgeImpersonator)
            .updateMinters(alice.address, false)
        ).to.be.revertedWith(
          ERROR_STRINGS.L2ERC20Mintable.UNAUTHORIZED_TOKEN_ROLE_ADMIN
        )
      })
    })
  })
})
