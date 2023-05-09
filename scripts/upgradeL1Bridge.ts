import hre from 'hardhat'
import { getProxyAdmin } from '../test/utils/fixtures'
import { L1ECOBridge } from '../typechain-types'

const L1_NETWORK = 'goerli'

const l1BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'

async function main() {
  hre.changeNetwork(L1_NETWORK)

  const l1ProxyAdmin = await getProxyAdmin()

  const bridge = await hre.ethers.getContractAt('L1ECOBridge',l1BridgeProxyAddress) as L1ECOBridge

  const upgrader_address = await bridge.upgrader()
  const [me] = await hre.ethers.getSigners()
  if ((await me.getAddress()) !== upgrader_address) {
    throw('you need to be the upgrader to run this script')
  }

  const owner = await l1ProxyAdmin.owner()
  if (owner !== l1BridgeProxyAddress) {
    throw('the bridge must own itself to run this script')
  }

  const oldImpl = await l1ProxyAdmin.getProxyImplementation(l1BridgeProxyAddress)
  console.log(`old implementation is: ${oldImpl}`)

  const L1ECOBridgeFactory = await hre.ethers.getContractFactory('L1ECOBridge')
  const newL1ECOBridgeImpl = await L1ECOBridgeFactory.deploy()
  await newL1ECOBridgeImpl.deployed()
  console.log(`new L1 Bridge deployed to ${newL1ECOBridgeImpl.address}`)
  
  const tx = await bridge.upgradeSelf(newL1ECOBridgeImpl.address)
  await tx.wait()
  console.log(`L1 Bridge upgraded`)

  const newImpl = await l1ProxyAdmin.getProxyImplementation(l1BridgeProxyAddress)
  console.log(`new implementation is: ${newImpl}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
