import hre from 'hardhat'
import { L1ECOBridge, ECO } from '../typechain-types'

const bridgeAmount = '500000' // in full ECO

const l1BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'
const l1Network = 'goerli'
const L1_ECO_ADDRESS = '0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3'
const l2EcoProxyAddress = '0x54bBECeA38ff36D32323f8A754683C1F5433A89f'

const l2gas = '10'

async function main() {
  hre.changeNetwork(l1Network)
  const L1ECOBridgeContract = await hre.ethers.getContractFactory('L1ECOBridge')
  const bridge = (await L1ECOBridgeContract.attach(
    l1BridgeProxyAddress
  )) as L1ECOBridge
  const ECOContract = await hre.ethers.getContractFactory('ECO')
  const eco = (await ECOContract.attach(L1_ECO_ADDRESS)) as ECO

  const weiAmount = hre.ethers.utils.parseEther(bridgeAmount)

  const tx1 = await eco.approve(l1BridgeProxyAddress, weiAmount)
  await tx1.wait()

  const tx2 = await bridge.depositERC20(
    L1_ECO_ADDRESS,
    l2EcoProxyAddress,
    weiAmount,
    l2gas,
    hre.ethers.utils.arrayify('0x1234')
  )
  await tx2.wait()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
