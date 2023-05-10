import hre from 'hardhat'
import { getProxyAdmin } from '../test/utils/fixtures'
import { L1ECOBridge, L2ECOBridge } from '../typechain-types'

const L1_NETWORK = 'goerli'
const L2_NETWORK = 'goerliOptimism'

const l1BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'
const l2BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'

const l2gas = '10'

async function main() {
  hre.changeNetwork(L1_NETWORK)

  const bridge = await hre.ethers.getContractAt('L1ECOBridge',l1BridgeProxyAddress) as L1ECOBridge

  const upgrader_address = await bridge.upgrader()
  const [me] = await hre.ethers.getSigners()
  if ((await me.getAddress()) !== upgrader_address) {
    throw('you need to be the upgrader to run this script')
  }

  // deploy new contract
  hre.changeNetwork(L2_NETWORK)

  const l2ProxyAdmin = await getProxyAdmin()

  const owner = await l2ProxyAdmin.owner()
  if (owner !== l2BridgeProxyAddress) {
    throw('the bridge must own the proxy admin to run this script')
  }

  const oldImpl = await l2ProxyAdmin.getProxyImplementation(l2BridgeProxyAddress)
  console.log(`old implementation is: ${oldImpl}`)

  const L2ECOBridgeFactory = await hre.ethers.getContractFactory('L2ECOBridge')
  const newL2ECOBridgeImpl = await L2ECOBridgeFactory.deploy()
  await newL2ECOBridgeImpl.deployed()
  console.log(`new L2 Bridge deployed to ${newL2ECOBridgeImpl.address}`)

  hre.changeNetwork(L1_NETWORK)
  
  const tx = await bridge.upgradeL2Bridge(newL2ECOBridgeImpl.address, l2gas)
  await tx.wait()
  console.log(`L2 Bridge upgraded`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
