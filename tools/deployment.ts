import * as ethers from 'ethers'
import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk"
import * as fs from 'fs'
require('dotenv').config({ path: '.env' })

function getABI(path: string): ethers.utils.Interface {
    return new ethers.utils.Interface(JSON.parse(fs.readFileSync(path, 'utf8')).abi)
}

//ABIs

// const forwardProxyABI:ethers.utils.Interface = getABI(`artifacts/@helix-foundation/currency/contracts/proxy/ForwardProxy.sol/ForwardProxy.json`)
// const implementationUpdatingABI:ethers.utils.Interface = getABI(`artifacts/@helix-foundation/currency/contracts/test/ImplementationUpdatingTarget.sol/ImplementationUpdatingTarget.json`)
// const ecoInitializableABI:ethers.utils.Interface = getABI(`artifacts/@helix-foundation/currency/contracts/deploy/EcoInitializable.sol/EcoInitializable.json`)
const ecoABI:ethers.utils.Interface = getABI(`artifacts/@helix-foundation/currency/contracts/currency/ECO.sol/ECO.json`)

const L1ECOBridgeABI:ethers.utils.Interface = getABI('artifacts/contracts/bridge/L1ECOBridge.sol/L1ECOBridge.json')
const L2ECOBridgeABI:ethers.utils.Interface = getABI('artifacts/contracts/bridge/L2ECOBridge.sol/L2ECOBridge.json')
const L2ECOABI:ethers.utils.Interface = getABI('artifacts/contracts/token/L2ECO.sol/L2ECO.json')

const infuraAPIkey = process.env.API_KEY || ''
const pk = process.env.PRIVKEY || ''
const pk2 = process.env.OTHRKEY || ''
const POLICY = process.env.ROOT_POLICY || ''

const rpc_url1 = `https://goerli.infura.io/v3/${infuraAPIkey}`
const rpc_url2 = `https://optimism-goerli.infura.io/v3/${infuraAPIkey}`

const l1provider = new ethers.providers.JsonRpcProvider(rpc_url1)
const l2provider = new ethers.providers.JsonRpcProvider(rpc_url2)

const l1Wallet = new ethers.Wallet(pk, l1provider)
const l2Wallet = new ethers.Wallet(pk, l2provider)

let crossChainMessenger:CrossChainMessenger

async function setupOP() {
    const l1ChainId = (await l1provider.getNetwork()).chainId
    const l2ChainId = (await l2provider.getNetwork()).chainId
    crossChainMessenger = new CrossChainMessenger({
        l1ChainId: l1ChainId,
        l2ChainId: l2ChainId,
        l1SignerOrProvider: l1Wallet,
        l2SignerOrProvider: l2Wallet,
        bedrock: true
})
}

const L1_OP_MESSANGER_ADDRESS = '0x5086d1eEF304eb5284A0f6720f79403b4e9bE294'
const L2_OP_MESSANGER_ADDRESS = '0x4200000000000000000000000000000000000007'
const ID_ECO = ethers.utils.solidityKeccak256(['string'], ['ECO'])
const L1_BRIDGE_ADDRESS = '0x383eB66F810F56442351B642fC8b223C9C2e9B07'
const L2_BRIDGE_ADDRESS = '0x2b96D98da64E733B6014A41A2c580142ffe3fb2e'
const L1_ECO_ADDRESS = '0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3'
const L2_ECO_ADDRESS = '0xE44Eed627F3fb2B39B462f4EC90eB78513039f87'

// async function callFuse() {
//     const proxy = new ethers.Contract('0xfC6632E95588902C967BBdc47e1a7d28350f88b9', ecoInitializableABI.abi, wallet)

//     // fusing to an existing ecoxStaking
//     tx = await proxy.fuseImplementation('0x8c8119C3fD6e40b4C047C946480Abe306be04A7F')
//     tx = await tx.wait()
//     console.log(tx.status)

//     proxy = new ethers.Contract('0xfC6632E95588902C967BBdc47e1a7d28350f88b9', ecoxStakingABI.abi, wallet)
//     console.log(await proxy.implementation())
// }

// async function deployInitializeable() {
//     const initializeableFactory = ethers.ContractFactory.fromSolidity(ecoInitializableABI, l1Wallet)
//     const initializeable = await initializeableFactory.deploy(l1Wallet.address)
//     await initializeable.deployTransaction.wait()
//     console.log(initializeable.address)
// }

async function deployL1Bridge() {
    const bridgeFactory = ethers.ContractFactory.fromSolidity(L1ECOBridgeABI, l1Wallet)
    const currGasPrice = ethers.BigNumber.from(await l1Wallet.getGasPrice())
    const theNonce = await l1Wallet.getTransactionCount()
    console.log(currGasPrice.toString())
    console.log(theNonce)

    const bridge = await bridgeFactory.deploy({
        // gasPrice: currGasPrice.mul(14).div(10),
        // nonce: theNonce + 1
    })
    await bridge.deployTransaction.wait()
    console.log(bridge.address)
}

async function deployL2ECO() {
    console.log(await l2Wallet.getBalance())
    const L2ECOFactory = ethers.ContractFactory.fromSolidity(L2ECOABI, l2Wallet)
    const L2ECO = await L2ECOFactory.deploy()
    await L2ECO.deployTransaction.wait()
    console.log(L2ECO.address)
}

async function deployL2Bridge() {
    const bridgeFactory = ethers.ContractFactory.fromSolidity(L2ECOBridgeABI, l2Wallet)
    const bridge = await bridgeFactory.deploy(L2_OP_MESSANGER_ADDRESS, L1_BRIDGE_ADDRESS, L2_ECO_ADDRESS)
    await bridge.deployTransaction.wait()
    console.log(bridge.address)
}

// metamask fails to send goerli OP eth cuz sometimes zero gas cost
async function sendGOR(_amt: string, address: string) {
    const amt = ethers.utils.parseEther(_amt)
    const tx = await l2Wallet.sendTransaction({
        to: address,
        value: amt
    })
    const {status} = await tx.wait()
    console.log(status)
}

async function initializeL2ECO() {
    const l2eco = new ethers.Contract(L2_ECO_ADDRESS, L2ECOABI.fragments, l2Wallet)
    const tx = await l2eco.initialize(L1_ECO_ADDRESS, L2_BRIDGE_ADDRESS, l2Wallet.address)
    const {status} = await tx.wait()
    console.log(status)
    console.log((await l2eco.linearInflationMultiplier()).toString())
}

async function initializeL1Bridge() {
    const l1bridge = new ethers.Contract(L1_BRIDGE_ADDRESS, L1ECOBridgeABI.fragments, l1Wallet)
    const tx = await l1bridge.initialize(L1_OP_MESSANGER_ADDRESS, L2_BRIDGE_ADDRESS, L2_ECO_ADDRESS, l1Wallet.address)
    const {status} = await tx.wait()
    console.log(status)
    console.log((await l1bridge.inflationMultiplier()).toString())
}

// async function deployImplthing() {
//     // 
//     const implThingFactory = new ethers.ContractFactory(implementationUpdatingABI.abi, implementationUpdatingABI.bytecode, wallet)
//     const implThing = await implThingFactory.deploy()
//     await implThing.deployTransaction.wait()
//     console.log(`implThing.address: ${implThing.address}`)
// }

// async function newProxy() {
//     const proxyFactory = new ethers.ContractFactory(forwardProxyABI.abi, forwardProxyABI.bytecode, wallet)
//     const proxy = await proxyFactory.deploy('0xA2346A2AF137Fba4cEe65C01e3C8225537a8eb35')
//     await proxy.deployTransaction.wait()
//     console.log(`staking proxy: ${proxy.address}`)
// }

async function rebaseCrossChain() {
    const l1bridge = new ethers.Contract(L1_BRIDGE_ADDRESS, L1ECOBridgeABI.fragments, l1Wallet)
    const l2gas = '10'
    const tx = await l1bridge.rebase(l2gas)
    const {status} = await tx.wait()
    console.log(`${status == 1 ? 'yay! ' : 'not '} rebased!`)
}

async function approveAndDeposit() {
    const l1bridge = new ethers.Contract(L1_BRIDGE_ADDRESS, L1ECOBridgeABI.fragments, l1Wallet)
    const l1Eco = new ethers.Contract(L1_ECO_ADDRESS, ecoABI.fragments, l1Wallet)
    const amount = ethers.utils.parseEther('1')
    const l2gas = '10000'

    const data = ethers.utils.arrayify('0x1234')
    console.log(ethers.utils.isBytes(data))

    const tx1 = await l1Eco.approve(L1_BRIDGE_ADDRESS, amount)
    const {status: status1} = await tx1.wait()
    console.log(status1)

    const tx2 = await l1bridge.depositERC20(L1_ECO_ADDRESS, L2_ECO_ADDRESS, amount, l2gas, data)
    const {status: status2} = await tx2.wait()
    console.log(status2)
}

async function bridgeItBackNowYall() {
    const data = ethers.utils.arrayify('0x1234')
    const amount = ethers.utils.parseEther('1')
    const l1gas = '200000'
    const l2bridge = new ethers.Contract(L2_BRIDGE_ADDRESS, L2ECOBridgeABI.fragments, l2Wallet)

    const tx = await l2bridge.withdraw(L2_ECO_ADDRESS, amount , l1gas, data)
    const {hash} = tx
    const {status} = await tx.wait()
    console.log(status === 1 ? hash : 'failure')
}

async function checkInterface() {
    const l2Eco = new ethers.Contract(L2_ECO_ADDRESS, L2ECOABI.fragments, l2Wallet)
    const tx = await l2Eco.supportsInterface('0x1d1d8b63')
    console.log(tx)
}

async function proveWithdrawal() {
    const withdrawalTx1 = { hash: '0x97b9c80097b77d5d79813b5367e515d83c25d21185550ed7b9d9c51348b016c0' }
    await crossChainMessenger.waitForMessageStatus(withdrawalTx1.hash, MessageStatus.READY_TO_PROVE)
    const withdrawalTx2 = await crossChainMessenger.proveMessage(withdrawalTx1.hash)
    const {status: statusTx2} = await withdrawalTx2.wait()

    if (statusTx2 != 1) { throw "prove failed" }
}

async function finalizeWithdrawal() {
    const withdrawalTx1 = { hash: '0x97b9c80097b77d5d79813b5367e515d83c25d21185550ed7b9d9c51348b016c0' }
    await crossChainMessenger.waitForMessageStatus(withdrawalTx1.hash, MessageStatus.READY_FOR_RELAY)
    const withdrawalTx3 = await crossChainMessenger.finalizeMessage(withdrawalTx1.hash)
    await withdrawalTx3.wait()  
    const {status: statusTx3} = await withdrawalTx3.wait()

    if (statusTx3 != 1) { throw "lame3" }
}

async function main() {
    await setupOP()
    // await deployL1Bridge()
    // await deployL2Bridge()
    // await sendGOR('.97', 'ADDRESS')
    // await deployL2ECO()
    // await initializeL2ECO()
    // await initializeL1Bridge()
    // await approveAndDeposit()
    // await rebaseCrossChain()
    // await bridgeItBackNowYall()
    // await checkInterface()
    await proveWithdrawal()
    await finalizeWithdrawal()
}

main()