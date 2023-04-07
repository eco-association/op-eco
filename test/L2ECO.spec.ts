import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { smock, FakeContract, MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import * as L2CrossDomainMessenger from '@eth-optimism/contracts/artifacts/contracts/L2/messaging/L2CrossDomainMessenger.sol/L2CrossDomainMessenger.json'

import { expect } from './tools/setup'
import { NON_NULL_BYTES32, NON_ZERO_ADDRESS } from './tools/constants'
import { getContractInterface, deployFromABI, deployFromName } from './tools/contracts'

const ERROR_STRINGS = {
  ALREADY_INITIALIZED: 'Contract has already been initialized.',
  INVALID_MINTER: 'not authorized to mint',
  INVALID_BURNER: 'not authorized to burn',
  INVALID_REBASER: 'not authorized to rebase',
  INVALID_TOKEN_ROLE_ADMIN: 'not authorized to edit roles',
}

const DUMMY_L1_ERC20_ADDRESS = '0xaBBAABbaaBbAABbaABbAABbAABbaAbbaaBbaaBBa'
const DUMMY_L1_BRIDGE_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'
const DUMMY_L2_BRIDGE_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'

describe('L2ECOBridge', () => {
  const INITIAL_TOTAL_SUPPLY = 100_000
  const ALICE_INITIAL_BALANCE = 50_000

  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let l2BridgeImpersonator: SignerWithAddress
  before(async () => {
    // Create a special signer which will enable us to send messages from the L2Messenger contract
    ;[alice, bob, l2BridgeImpersonator] = await ethers.getSigners()
  })

  let L2ECO: Contract
  beforeEach(async () => {

    // Deploy an L2 ERC20
    L2ECO = await deployFromName('L2ECO', {
      args: [
        l2BridgeImpersonator.address,
      ],
    })

    await L2ECO.initialize(l2BridgeImpersonator.address, l2BridgeImpersonator.address)
  })

  // test initialize reverting
  describe('initialize', () => {
    it('Should only be callable once', async () => {
      await expect(
        L2ECO.initialize(
          NON_ZERO_ADDRESS, // this is cuz a zero address could trigger a different revert
          ethers.constants.AddressZero,
        )
      ).to.be.revertedWith(ERROR_STRINGS.ALREADY_INITIALIZED)
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

        await expect(
          L2ECO.connect(l2BridgeImpersonator).updateMinters(alice.address, false)
        ).to.be.revertedWith(ERROR_STRINGS.INVALID_TOKEN_ROLE_ADMIN)
      })
    })
  })

  // describe('withdrawals', () => {
  //   const withdrawAmount = 1_000

  //   let Mock__L2Token: MockContract<Contract>
  //   beforeEach(async () => {
  //     // Deploy a smodded gateway so we can give some balances to withdraw
  //     Mock__L2Token = await (
  //       await smock.mock('L2StandardERC20')
  //     ).deploy(
  //       L2ECOBridge.address,
  //       DUMMY_L1_ERC20_ADDRESS,
  //       'L2Token',
  //       'L2T',
  //     )

  //     await Mock__L2Token.setVariable('_totalSupply', INITIAL_TOTAL_SUPPLY)
  //     await Mock__L2Token.setVariable('_balances', {
  //       [alice.address]: ALICE_INITIAL_BALANCE,
  //     })
  //     await Mock__L2Token.setVariable('l2Bridge', L2ECOBridge.address)
  //   })

  //     // Assert Alice's balance went down
  //     expect(await Mock__L2Token.balanceOf(alice.address)).to.deep.equal(
  //       ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount)
  //     )

  //     // Assert totalSupply went down
  //     expect(await Mock__L2Token.totalSupply()).to.deep.equal(
  //       ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount)
  //     )
  //   })

})