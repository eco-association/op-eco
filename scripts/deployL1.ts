import { ethers } from "hardhat"
import { deployL1 } from "../test/utils/fixtures"

const SHARK_TEST_ACCOUNT_ADDRESS = '0x6F81Ac980BC23fc70EcE1635D59ddBb3F12E6150'
const L1_OP_MESSANGER_ADDRESS = '0x5086d1eEF304eb5284A0f6720f79403b4e9bE294'
const L1_ECO_ADDRESS = '0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3'

async function main() {
    let [l1Bridge, proxyAdminL1] = await deployL1(L1_OP_MESSANGER_ADDRESS, ethers.constants.AddressZero, L1_ECO_ADDRESS, SHARK_TEST_ACCOUNT_ADDRESS)
    console.log(`L1 Bridge deployed to: ${l1Bridge.address}`)
    console.log(`Proxy Admin L1 deployed to: ${proxyAdminL1.address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
