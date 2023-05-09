import hre from 'hardhat'
import { L2ECOBridge } from '../typechain-types'

const l2BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'
const L2_NETWORK = 'goerliOptimism'

async function main() {
  hre.changeNetwork(L2_NETWORK)
  const bridge = await hre.ethers.getContractAt('L2ECOBridge',l2BridgeProxyAddress) as L2ECOBridge

  console.log(`l1TokenBridge ${await bridge.l1TokenBridge()}`)
  console.log(`l2EcoToken ${await bridge.l2EcoToken()}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
