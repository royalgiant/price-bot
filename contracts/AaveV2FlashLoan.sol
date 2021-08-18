pragma solidity 0.6.12;

import { FlashLoanReceiverBase } from "./interfaces/FlashLoanReceiverBase.sol";
import { ILendingPool } from "./interfaces/ILendingPool.sol";
import { ILendingPoolAddressesProvider } from "./interfaces/ILendingPoolAddressesProvider.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import './interfaces/IUniswapV2Router02.sol';
import "@studydefi/money-legos/kyber/contracts/KyberNetworkProxy.sol";

/** 
    !!!
    Never keep funds permanently on your FlashLoanReceiverBase contract as they could be 
    exposed to a 'griefing' attack, where the stored funds are used by an attacker.
    !!!
 */
contract AaveV2FlashLoan is FlashLoanReceiverBase {
    IUniswapV2Router02 public sushiRouter;
    KyberNetworkProxyRouter public kyberRouter;
    uint constant deadline = 10 days; // Date the trade is due

    address payable owner;
    constructor() public {
        owner = msg.sender;
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
        (string memory exchangeA, string memory exchangeB, address exchangeAddressA, address exchangeAddressB) = abi.decode(params, (string, string));
        setExchangeRouterFor(exchangeA, exchangeAddressA);
        setExchangeRouterFor(exchangeB, exchangeAddressB);
        
        // Exchange Asset0 for Asset1 (i.e. Sell DAI to Buy ETH; like ETH could be 1000 DAI here)
        if(keccak256(abi.encodePacked(exchangeA)) == keccak256(abi.encodePacked("sushi"))) {
            // Run swap for asset[1] with SushiSwap
            uint asset1Received = sushiRouter.swapExactTokensForTokens(amount[0], amounts[1], assets, address(this), deadline)[1]; // Get Asset1 (i.e. ETH) in return
        } else if(keccak256(abi.encodePacked(exchangeA)) == keccak256(abi.encodePacked("kyber"))) {
            // Run swap for asset[1] with Kyber
            uint asset1Received = kyberRouter.swapTokenToToken(IERC20(assets[0]), amount[0], IERC20(assets[1]), amount[1]);
        }

        // Exchange Asset1 for Asset0 (i.e. Sell ETH for DAI here; like ETH could be 1010 DAI here)
        if(keccak256(abi.encodePacked(exchangeB)) == keccak256(abi.encodePacked("sushi"))) {
            // Run swap for asset[0] with SushiSwap
            uint asset0Received = sushiRouter.swapExactTokensForTokens(amount[1], amounts[0], assets, address(this), deadline)[0]; // Get Asset0 (i.e. DAI) in return
        } else if(keccak256(abi.encodePacked(exchangeB)) == keccak256(abi.encodePacked("kyber"))) {
            // Run swap for asset[0] with Kyber
            uint asset0Received = kyberRouter.swapTokenToToken(IERC20(assets[1]), amount[1], IERC20(assets[0]), amount[0]);
        }

        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.
        
        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint i = 0; i < assets.length; i++) {
            uint amountOwing = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(LENDING_POOL), amountOwing);
        }

        // Transfer profits to owner of the contract
        owner.transfer(RESIDUAL_PROFITS);
        return true;
    }

    function setExchangeRouterFor(string memory exchange, address exchangeAddress) internal pure {
        if (keccak256(abi.encodePacked(exchange)) == keccak256(abi.encodePacked("sushi"))) {
            sushiRouter = IUniswapV2Router02(exchangeAddress);
        } else if (keccak256(abi.encodePacked(exchange)) == keccak256(abi.encodePacked("kyber"))) {
            kyberRouter = KyberNetworkProxy(exchangeAddress);
        }
    }
    
    function myFlashLoanCall(address token0, address token1, uint _amount0, uint _amount1, string exchangeA, string exchangeB) public external{
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
        bytes memory params = abi.encode(exchangeA, exchangeB, exchangeAddressA, exchangeAddressB);
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