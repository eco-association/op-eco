import { ethers, upgrades } from "hardhat"
import { L2ECO, L2ECOBridge } from "../../dist/types"
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
export async function deployL2(l2CrossDomainMessenger: Address, l1Bridge: Address, l1Token: Address, initialPauser: Address): Promise<[L2ECO, L2ECOBridge]> {

    const L2EcoContract = await ethers.getContractFactory("L2ECO")
    const l2EcoProxyInitial = await upgrades.deployProxy(L2EcoContract, [//pass dummy values for the constructor until the L2ECOBridge is deployed
        AddressZero,
        AddressZero,
        AddressZero
    ] as L2EcoContract, {
        initializer: "initialize",
        constructorArgs: [NON_ZERO_ADDRESS],
        // unsafeAllow: ['constructor', 'state-variable-immutable', 'state-variable-assignment']
    })

    await l2EcoProxyInitial.deployed()

    const L2ECOBridgeContract = await ethers.getContractFactory("L2ECOBridge")
    const l2Bridge = await L2ECOBridgeContract.deploy(l2CrossDomainMessenger, l1Bridge, l2EcoProxyInitial.address)
    await l2Bridge.deployed()


    const l2EcoProxyFinal = await upgrades.upgradeProxy(l2EcoProxyInitial.address, L2EcoContract, {
        call: { fn: "initialize", args: [
            l1Token,
            l2Bridge.address, 
            initialPauser
        ]  as L2EcoContract,
        opts: {constructorArgs: [NON_ZERO_ADDRESS],}
        },
    })

    console.log("L2ECO proxy admin address: ", await upgrades.admin.getManifestAdmin())
    console.log("L2ECO proxy address: ", l2EcoProxyFinal.address)

    await upgrades.admin.transferProxyAdminOwnership(l2Bridge.address)

    // @ts-ignore
    return [l2EcoProxyFinal, l2Bridge]
}

export async function deployByName(name: string, ...args: any[]): Promise<any> {
    const Contract = await ethers.getContractFactory(name)
    const contract = await Contract.deploy(...args)
    await contract.deployed()
    return contract
}