pragma solidity 0.6.12;

import { FlashLoanReceiverBase } from "./interfaces/FlashLoanReceiverBase.sol";
import { ILendingPool } from "./interfaces/ILendingPool.sol";
import { ILendingPoolAddressesProvider } from "./interfaces/ILendingPoolAddressesProvider.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

/** 
    !!!
    Never keep funds permanently on your FlashLoanReceiverBase contract as they could be 
    exposed to a 'griefing' attack, where the stored funds are used by an attacker.
    !!!
 */
contract AaveV2FlashLoan is FlashLoanReceiverBase {

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
        // Arbitrage
        (string exchangeA, string exchangeB) = abi.decode(params, (string, string));
        
        
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
        owner.transfer(RESIDUAL_PROFITS)
        return true;
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