pragma solidity ^0.6.6;
// SPDX-License-Identifier: MIT

import { FlashLoanReceiverBase } from "../interfaces/FlashLoanReceiverBase.sol";
import { ILendingPool } from "../interfaces/ILendingPool.sol";
import { ILendingPoolAddressesProvider } from "../interfaces/ILendingPoolAddressesProvider.sol";
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IUniswapV2Router02.sol';
import "./Withdrawable.sol";

// Kyber Mainnet Address: 0x9aab3f75489902f3a48495025729a0af77d4b11e
interface KyberNetworkProxy {
    function swapTokenToToken(IERC20 src, uint256 srcAmount, IERC20 dest, uint256 minConversionRate) external returns (uint256);
}
/** 
    !!!
    Never keep funds permanently on your FlashLoanReceiverBase contract as they could be 
    exposed to a 'griefing' attack, where the stored funds are used by an attacker.
    !!!
 */
contract AaveV2FlashLoan is FlashLoanReceiverBase, Withdrawable {
    IUniswapV2Router02 public sushiRouter;
    KyberNetworkProxy public kyberRouter;
    uint private asset0Received;
    uint constant deadline = 10 days; // Date the trade is due

    constructor(address _kyberRouter, address _sushiRouter, address provider) public FlashLoanReceiverBase(provider) {
        kyberRouter = KyberNetworkProxy(_kyberRouter);
        sushiRouter = IUniswapV2Router02(_sushiRouter);
    }

    /**
        This function is called after your contract has received the flash loaned amount
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    )
        external
        override
        returns (bool)
    {

        //
        // This contract now has the funds requested.
        // Arbitrage Example: Borrow DAI on Uni -> Exchange DAI for ETH on Sushi -> Sell ETH for DAI on Uni
        (string memory exchangeA, string memory exchangeB) = abi.decode(params, (string, string));
        
        // Exchange Asset0 for Asset1 on Exchange A (i.e. Sell Borrowed WETH to Buy DAI; like WETH could be 3000 DAI here)
        if(keccak256(abi.encodePacked(exchangeA)) == keccak256(abi.encodePacked("sushi"))) {
            // Run swap for asset[1] with SushiSwap
            sushiRouter.swapExactTokensForTokens(amounts[0], amounts[1], assets, address(this), deadline)[1]; // Get Asset1 (i.e. DAI) in return
        } else if(keccak256(abi.encodePacked(exchangeA)) == keccak256(abi.encodePacked("kyber"))) {
            // Run swap for asset[1] with Kyber
            kyberRouter.swapTokenToToken(IERC20(assets[0]), amounts[0], IERC20(assets[1]), amounts[1]);
        }
       
        // Exchange Asset1 for Asset0 on Exchange B (i.e. Sell DAI for WETH here; like WETH could be 2900 DAI here)
        if(keccak256(abi.encodePacked(exchangeB)) == keccak256(abi.encodePacked("sushi"))) {
            // Run swap for asset[0] with SushiSwap
            asset0Received = sushiRouter.swapExactTokensForTokens(amounts[1], amounts[0], assets, address(this), deadline)[0]; // Get Asset0 (i.e. WETH) in return
        } else if(keccak256(abi.encodePacked(exchangeB)) == keccak256(abi.encodePacked("kyber"))) {
            // Run swap for asset[0] with Kyber
            asset0Received = kyberRouter.swapTokenToToken(IERC20(assets[1]), amounts[1], IERC20(assets[0]), amounts[0]);
        } else {
            asset0Received = 0; // Default, we should actually never get in here.
        }

        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.
        require(asset0Received > amounts[0].add(premiums[0]), 'Failed arb.');
        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint i = 0; i < assets.length; i++) {
            uint amountOwing = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(LENDING_POOL), amountOwing);
        }

        return true;
    }
    
    function myFlashLoanCall(address token0, address token1, uint _amount0, uint _amount1, string memory exchangeA, string memory exchangeB) public {
        address receiverAddress = address(this);

        address[] memory assets = new address[](2);
        assets[0] = address(token0);
        assets[1] = address(token1);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = _amount0;
        amounts[1] = _amount1;

        // 0 = no debt, 1 = stable, 2 = variable; always use 0, for flash loans, because 1 and 2 holds the debt.    
        uint256[] memory modes = new uint256[](2);
        modes[0] = 0;
        modes[1] = 0;

        address onBehalfOf = address(this);
        // Encoding an address and a uint
        bytes memory params = abi.encode(exchangeA, exchangeB);
        uint16 referralCode = 0;

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }
}