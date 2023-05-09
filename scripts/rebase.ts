import hre from 'hardhat'
import { L1ECOBridge } from '../typechain-types'

const l1BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'
const l1Network = 'goerli'

const l2gas = '10'

async function main() {
  hre.changeNetwork(l1Network)
  const bridge = await hre.ethers.getContractAt('L1ECOBridge',l1BridgeProxyAddress) as L1ECOBridge

  const tx = await bridge.rebase(l2gas)
  await tx.wait()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
