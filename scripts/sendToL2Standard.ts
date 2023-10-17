import hre from 'hardhat'
import { ECOx, IL1ERC20Bridge } from '../typechain-types'
import { CrossChainMessenger, MessageStatus } from '@eth-optimism/sdk'
import {
  L1_ECOX_ADDRESS,
  L1_NETWORK,
  L1_OP_STANDARD_BRIDGE,
  L2_NETWORK,
  l2EcoXProxyAddress,
} from './constants'
import { setupOP } from '../test/utils/fixtures'

const bridgeAmount = '5' // in full ECOx

const l2gas = '10'

// commented out code will work once the bridges are updated on optimism's side

async function main() {
  hre.changeNetwork(L1_NETWORK)
  
  const ecox = (await hre.ethers.getContractAt('ECOx', L1_ECOX_ADDRESS)) as ECOx

  const bridge = (await hre.ethers.getContractAt(
    'IL1ERC20Bridge',
    L1_OP_STANDARD_BRIDGE
  )) as IL1ERC20Bridge

  // const crossChainMessenger = await setupOP(L1_NETWORK, L2_NETWORK)

  const weiAmount = hre.ethers.utils.parseEther(bridgeAmount)

  const tx1 = await ecox.approve(L1_OP_STANDARD_BRIDGE, weiAmount)
  await tx1.wait()

  // const depositTx = await crossChainMessenger.depositERC20(L1_ECOX_ADDRESS, l2EcoXProxyAddress, bridgeAmount)
  // await depositTx.wait()

  console.log("deposit initiated")

  // await crossChainMessenger.waitForMessageStatus(depositTx.hash, MessageStatus.RELAYED)

  const tx2 = await bridge.depositERC20(
    L1_ECOX_ADDRESS,
    l2EcoXProxyAddress,
    weiAmount,
    l2gas,
    hre.ethers.utils.arrayify('0x1234')
  )
  await tx2.wait()

  console.log("deposit successful")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
