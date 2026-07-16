// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PermissionedDynaVault} from "../src/PermissionedDynaVault.sol";
import {USDCMiningAdapter} from "../src/adapters/USDCMiningAdapter.sol";
import {LBTCPouchAdapter} from "../src/adapters/LBTCPouchAdapter.sol";

/// @title DeployDynaVault
/// @notice Deploys the PermissionedDynaVault v2.1 + its B1/B2 adapters to Base Sepolia (TESTNET ONLY,
///         chainId 84532). Mainnet stays gated on the Spearbit audit — never run against mainnet.
///         Wires the Mining Note layout (B1 4000 non-idle, B2 2700 non-idle, B3 3300 idle) and the
///         reference operating parameters from `docs/VAULT_SPEC_V2.1.md` §8.
/// @dev    Required env vars:
///           - DEPLOYER_PRIVATE_KEY : uint256 broadcasting key.
///           - VAULT_ASSET          : USDC on Base Sepolia (0x036CbD53842c5426634e7929541eC2318f3dCF7e).
///           - VAULT_OWNER          : initial owner (manager multisig in prod; EOA on testnet).
///           - VAULT_KEEPER         : operational keeper bot.
///           - VAULT_TVL_CAP        : TVL cap in asset units (0 = uncapped).
///           - VAULT_ELEC_PAYEE     : electricity payee (optional; set later if 0).
///         Run WITHOUT --broadcast first to simulate. Broadcasting is a deliberate operator action.
contract DeployDynaVault is Script {
    // Spec §8 reference parameters.
    uint256 internal constant B1_BPS = 4_000;
    uint256 internal constant B2_BPS = 2_700;
    uint256 internal constant B3_BPS = 3_300;
    uint256 internal constant MONTHLY_ELEC = 16_408e6; // 16,408 USDC (6 decimals)
    uint256 internal constant CURTAIL_PRE = 35_968e6;
    uint256 internal constant CURTAIL_POST = 72_318e6;
    uint256 internal constant HALVING_MONTH = 21;
    uint256 internal constant DURATION_MONTHS = 24;

    function run()
        external
        returns (PermissionedDynaVault vault, USDCMiningAdapter b1, LBTCPouchAdapter b2)
    {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address assetAddr = vm.envAddress("VAULT_ASSET");
        address owner = vm.envAddress("VAULT_OWNER");
        address keeper = vm.envAddress("VAULT_KEEPER");
        uint256 tvlCap = vm.envUint("VAULT_TVL_CAP");
        address elecPayee = vm.envOr("VAULT_ELEC_PAYEE", address(0));

        require(assetAddr != address(0), "VAULT_ASSET unset");
        require(owner != address(0), "VAULT_OWNER unset");
        require(keeper != address(0), "VAULT_KEEPER unset");

        vm.startBroadcast(deployerKey);

        vault = new PermissionedDynaVault(IERC20(assetAddr), owner, keeper, tvlCap);
        b1 = new USDCMiningAdapter(IERC20(assetAddr), address(vault));
        b2 = new LBTCPouchAdapter(IERC20(assetAddr), address(vault));

        // Owner-gated wiring: only works if DEPLOYER == owner. Otherwise perform these from the owner
        // account after deployment (kept explicit so the deployer sees what still needs owner action).
        if (owner == vm.addr(deployerKey)) {
            vault.setMiningNoteMode(true);
            vault.addStrategy(address(b1), B1_BPS, false);
            vault.addStrategy(address(b2), B2_BPS, false);
            vault.addStrategy(address(0), B3_BPS, true);
            vault.setMonthlyElecCost(MONTHLY_ELEC);
            vault.setCurtailmentThresholds(CURTAIL_PRE, CURTAIL_POST);
            vault.setHalvingMonth(HALVING_MONTH);
            vault.setProductDurationMonths(DURATION_MONTHS);
            if (elecPayee != address(0)) {
                vault.setElecPayee(elecPayee);
            }
        }

        vm.stopBroadcast();

        console.log("PermissionedDynaVault:", address(vault));
        console.log("B1 USDCMiningAdapter: ", address(b1));
        console.log("B2 LBTCPouchAdapter:  ", address(b2));
        console.log("Asset (USDC):         ", assetAddr);
        console.log("Owner:                ", owner);
        console.log("Keeper:               ", keeper);
        console.log("TVL cap:              ", tvlCap);
        if (owner != vm.addr(deployerKey)) {
            console.log("NOTE: deployer != owner - run addStrategy/config from the owner account.");
        }
    }
}
