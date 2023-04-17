import { ethers } from 'hardhat'
const hre = require("hardhat");
import { Contract } from 'ethers'
import { smock, FakeContract, MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { AddressZero } from "@ethersproject/constants"

import * as L2CrossDomainMessenger from '@eth-optimism/contracts/artifacts/contracts/L2/messaging/L2CrossDomainMessenger.sol/L2CrossDomainMessenger.json'

import { NON_NULL_BYTES32, NON_ZERO_ADDRESS } from './utils/constants'
import {
  getContractInterface,
  deployFromName,
} from './utils/contracts'
import { expect } from 'chai'
import { ERROR_STRINGS } from './utils/errors'
import { deployL2, transferOwnership } from './utils/fixtures'
import { L2ECO, L2ECOBridge, ProxyAdmin } from '../typechain-types'

const DUMMY_L1_ERC20_ADDRESS = NON_ZERO_ADDRESS
const DUMMY_L1_BRIDGE_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'

describe('L2ECOBridge tests', () => {
  const INITIAL_TOTAL_SUPPLY = 100000
  const ALICE_INITIAL_BALANCE = 50000

  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let pausingPaul: SignerWithAddress
  let l2MessengerImpersonator: SignerWithAddress
  before(async () => {
    // Create a special signer which will enable us to send messages from the L2Messenger contract
    ;[alice, bob, pausingPaul, l2MessengerImpersonator] = await ethers.getSigners()
  })

  let L2ECOBridge: Contract
  let MOCK_L2ECO: MockContract<Contract>
  let Fake__L2CrossDomainMessenger: FakeContract
  beforeEach(async () => {
    //reset the network as the proxy admin deploy is done to a predetermined address
    await hre.network.provider.send("hardhat_reset")
    // Get a new mock L2 messenger
    Fake__L2CrossDomainMessenger = await smock.fake<Contract>(
      L2CrossDomainMessenger.abi,
      // This allows us to use an ethers override {from: Mock__L2CrossDomainMessenger.address} to mock calls
      { address: await l2MessengerImpersonator.getAddress() }
    )

    // Deploy an L2 ERC20
    MOCK_L2ECO = await (
      await smock.mock('L2ECO')
    ).deploy()


    // Deploy the contract under test
    L2ECOBridge = await deployFromName('L2ECOBridge', {
      args: [Fake__L2CrossDomainMessenger.address, DUMMY_L1_BRIDGE_ADDRESS, MOCK_L2ECO.address, AddressZero],
    })

    await MOCK_L2ECO.setVariable('_initializing', false)
    await MOCK_L2ECO.initialize(DUMMY_L1_ERC20_ADDRESS, L2ECOBridge.address, AddressZero)
    //set rebase to 1 so our numbers arent crazy big
    await MOCK_L2ECO.setVariable('linearInflationMultiplier', 1)
  })

  // test the transfer flow of moving a token from L2 to L1
  describe('finalizeDeposit', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L2 account', async () => {
      await expect(
        L2ECOBridge.finalizeDeposit(
          DUMMY_L1_ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          0,
          NON_NULL_BYTES32
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ECOBridge)', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        NON_ZERO_ADDRESS
      )

      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).finalizeDeposit(
          DUMMY_L1_ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          0,
          NON_NULL_BYTES32,
          {
            from: Fake__L2CrossDomainMessenger.address,
          }
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should only allow L2ECO token to be deposited', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )

      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).finalizeDeposit(
          DUMMY_L1_ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          0,
          NON_NULL_BYTES32,
          {
            from: Fake__L2CrossDomainMessenger.address,
          }
        )
      ).to.be.revertedWith(ERROR_STRINGS.L2ECOBridge.INVALID_L2ECO_ADDRESS)
    })

    it('should validate the L2 and L1 tokens match', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )

      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).finalizeDeposit(
          alice.address,
          MOCK_L2ECO.address,
          alice.address,
          bob.address,
          0,
          NON_NULL_BYTES32,
          {
            from: Fake__L2CrossDomainMessenger.address,
          }
        )
      ).to.be.revertedWith(ERROR_STRINGS.L2ECOBridge.INVALID_L1_ADDRESS)
    })

    it('should credit funds to the depositor', async () => {
      const depositAmount = 100

      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )

      await expect(L2ECOBridge.connect(l2MessengerImpersonator).finalizeDeposit(
        DUMMY_L1_ERC20_ADDRESS,
        MOCK_L2ECO.address,
        alice.address,
        bob.address,
        depositAmount,
        NON_NULL_BYTES32,
        {
          from: Fake__L2CrossDomainMessenger.address,
        }
      )).to.emit(L2ECOBridge, "DepositFinalized")
        .withArgs(DUMMY_L1_ERC20_ADDRESS,
          MOCK_L2ECO.address,
          alice.address,
          bob.address,
          depositAmount,
          NON_NULL_BYTES32)

      expect(await MOCK_L2ECO.balanceOf(bob.address)).to.equal(depositAmount)
    })
  })

  describe('withdrawals', () => {
    const withdrawAmount = 1000

    beforeEach(async () => {
      await MOCK_L2ECO.setVariable('linearInflationMultiplier', 1)
      await MOCK_L2ECO.setVariable('_totalSupply', INITIAL_TOTAL_SUPPLY)
      await MOCK_L2ECO.setVariable('_balances', {
        [alice.address]: ALICE_INITIAL_BALANCE,
      })
    })

    it('withdraw reverts on tokens that are not our preset L2ECO', async () => {
      await expect(
        L2ECOBridge.connect(alice).withdraw(
          bob.address,
          withdrawAmount,
          0,
          NON_NULL_BYTES32
        )
      ).to.be.revertedWith(ERROR_STRINGS.L2ECOBridge.INVALID_L2ECO_ADDRESS)
    })

    it('withdraw() burns and sends the correct withdrawal message', async () => {
      await L2ECOBridge.connect(alice).withdraw(
        MOCK_L2ECO.address,
        withdrawAmount,
        0,
        NON_NULL_BYTES32
      )

      expect(
        Fake__L2CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L1_BRIDGE_ADDRESS,
        (await getContractInterface('L1ECOBridge')).encodeFunctionData(
          'finalizeERC20Withdrawal',
          [
            DUMMY_L1_ERC20_ADDRESS,
            MOCK_L2ECO.address,
            alice.address,
            alice.address,
            withdrawAmount,
            NON_NULL_BYTES32,
          ]
        ),
        0,
      ])

      // Assert Alice's balance went down
      expect(await MOCK_L2ECO.balanceOf(alice.address)).to.deep.equal(
        ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount)
      )

      // Assert totalSupply went down
      expect(await MOCK_L2ECO.totalSupply()).to.deep.equal(
        ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount)
      )
    })

    it('withdrawTo() burns and sends the correct withdrawal message', async () => {
      await L2ECOBridge.withdrawTo(
        MOCK_L2ECO.address,
        bob.address,
        withdrawAmount,
        0,
        NON_NULL_BYTES32
      )

      expect(
        Fake__L2CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L1_BRIDGE_ADDRESS,
        (await getContractInterface('L1ECOBridge')).encodeFunctionData(
          'finalizeERC20Withdrawal',
          [
            DUMMY_L1_ERC20_ADDRESS,
            MOCK_L2ECO.address,
            alice.address,
            bob.address,
            withdrawAmount,
            NON_NULL_BYTES32,
          ]
        ),
        0,
      ])

      // Assert Alice's balance went down
      expect(await MOCK_L2ECO.balanceOf(alice.address)).to.deep.equal(
        ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount)
      )

      // Assert totalSupply went down
      expect(await MOCK_L2ECO.totalSupply()).to.deep.equal(
        ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount)
      )
    })
  })

  describe('rebase', () => {

    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L2 account', async () => {
      await expect(
        L2ECOBridge.rebase(
          2
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ECOBridge)', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        NON_ZERO_ADDRESS
      )

      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).rebase(
          2
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should reject unauthorized rebase', async () => {
      await MOCK_L2ECO.setVariable('rebasers', {
        [L2ECOBridge.address]: false,
      })

      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )
      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).rebase(
          2
        )
      ).to.be.revertedWith(ERROR_STRINGS.L2ECO.UNAUTHORIZED_REBASER)
    })

    it('should validate the L2ECO inflation multiple', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )
      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).rebase(
          0
        )
      ).to.be.revertedWith(ERROR_STRINGS.L2ECOBridge.INVALID_INFLATION_MULTIPLIER)
    })

    it('should set the L2ECO inflation multiple', async () => {
      const inflationMultiplier = 2
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )

      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).rebase(
          inflationMultiplier
        )
      ).to.emit(L2ECOBridge, "RebaseInitiated")
        .withArgs(inflationMultiplier)
    })
  })

  describe('upgradeEco', () => {
    let newEcoImpl: MockContract<Contract>
    let proxyAdmin: ProxyAdmin, l2Eco: L2ECO, l2EcoBridge: L2ECOBridge
    beforeEach(async () => {
      ;[l2Eco, l2EcoBridge, proxyAdmin] = await deployL2(Fake__L2CrossDomainMessenger.address, DUMMY_L1_BRIDGE_ADDRESS, DUMMY_L1_ERC20_ADDRESS, alice.address, { adminBridge: false })
      newEcoImpl = await (
        await smock.mock('L2ECO')
      ).deploy()
    })

    it('onlyFromCrossDomainAccount should revert on calls from a non-crossDomainMessenger L2 account', async () => {
      await expect(
        l2EcoBridge.upgradeECO(
          newEcoImpl.address
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ECOBridge)', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        NON_ZERO_ADDRESS
      )

      await expect(
        l2EcoBridge.connect(l2MessengerImpersonator).upgradeECO(
          newEcoImpl.address
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_X_DOMAIN_MSG_SENDER)

    })

    it('should revert when bridge isn\'t owner of ProxyAdmin', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )

      await expect(
        l2EcoBridge.connect(l2MessengerImpersonator).upgradeECO(
          newEcoImpl.address
        )
      ).to.be.revertedWith(ERROR_STRINGS.OWNABLE.NOT_OWNER)
    })

    it('should upgrade the implementation and emit an event', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )

      await transferOwnership(l2EcoBridge.address)

      await expect(
        l2EcoBridge.connect(l2MessengerImpersonator).upgradeECO(
          newEcoImpl.address
        )
      ).to.emit(l2EcoBridge, "UpgradeECOImplementation")
        .withArgs(newEcoImpl.address)
    })
  })
})
