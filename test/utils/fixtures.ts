import { ethers, upgrades } from "hardhat"
import { L2ECO, L2ECOBridge, ProxyAdmin, TokenInitial__factory } from "../../typechain-types"
import { AddressZero } from "@ethersproject/constants"
import { Address } from "@eth-optimism/core-utils"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "ethers"
import { NON_ZERO_ADDRESS } from "./constants"

//L2Eco contract initilization parameter types
type L2EcoContract = [
    l1Token: string,
    l2Bridge: string,
    initialPauser: string
]

/**
 * Deploys the L2 contracts for testing. It first deploys the upgrades proxy, proxy admin, and the implementation contract for the L2ECO contract.
 * Then it deploys the L2ECOBridge contract with the L2ECO proxy address. Finally it deploys the real L2ECO contract through a implimentatioin
 * update of the proxy, with the L2ECOBridge address.
 *
 * @returns Returns the L2ECO and L2ECOBridge contracts.
 */
export async function deployL2(l2CrossDomainMessenger: Address, l1Bridge: Address, l1Token: Address, initialPauser: Address, opts: { adminBridge: boolean } = {adminBridge: true}): Promise<[L2ECO, L2ECOBridge, ProxyAdmin]> {
    const [owner] = await ethers.getSigners()

    const TokenInitialContract = await ethers.getContractFactory("TokenInitial")
    const proxyInitial = await upgrades.deployProxy(TokenInitialContract, [], {
        initializer: "initialize"
    })

    await proxyInitial.deployed()

    const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin

    const L2ECOBridgeContract = await ethers.getContractFactory("L2ECOBridge")
    const l2Bridge = await L2ECOBridgeContract.deploy(l2CrossDomainMessenger, l1Bridge, proxyInitial.address, proxyAdmin.address)
    await l2Bridge.deployed()

    const L2EcoContract = await ethers.getContractFactory("L2ECO")
    const l2EcoProxy = await upgrades.upgradeProxy(proxyInitial.address, L2EcoContract, {
        call: {
            fn: "initialize", args: [
                l1Token,
                l2Bridge.address,
                initialPauser
            ] as L2EcoContract
        }
    })

    //NOTE: ProxyAdmin address never changes for a given deployer id, breaks tests
    // console.log("L2ECO proxy admin address: ", (await upgrades.admin.getInstance()).address)

    // console.log("L2ECO proxy address: ", l2EcoProxy.address)
    // console.log("signer owner address: ", owner.address)
    // console.log("ProxyAdmin Owner: ", await proxyAdmin.owner())
    // console.log("ProxyAdmin address: ", proxyAdmin.address)
    // console.log("l2Bridge.address: ", l2Bridge.address)

    if (opts.adminBridge) {
        transferOwnership(l2Bridge.address) 
    }
    // console.log("ProxyAdmin Owner: ", await proxyAdmin.owner())

    return [l2EcoProxy as L2ECO, l2Bridge as L2ECOBridge, proxyAdmin]
}

export async function transferOwnership(newOwnerAddress: Address): Promise<void> {
    const [owner] = await ethers.getSigners()
    const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin
    await proxyAdmin.connect(owner).transferOwnership(newOwnerAddress)
}

export async function deployByName(name: string, ...args: any[]): Promise<any> {
    const Contract = await ethers.getContractFactory(name)
    const contract = await Contract.deploy(...args)
    await contract.deployed()
    return contract
}
