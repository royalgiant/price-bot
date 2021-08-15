pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import './UniswapV2Library.sol';
import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IERC20.sol';

contract TradeBot {
	address public factory; // central hub of UniSwap ecosystem that provides info about liquidity pools
	uint constant deadline = 10 days; // Date the trade is due
  	IUniswapV2Router02 public sushiRouter; // Central smart contract in the SushiSwap ecosystem that is used to trade in liquidity pools

	address payable owner;

	constructor(address _factory, address _sushiRouter) public {
		factory = _factory;
		sushiRouter = IUniswapV2Router02(_sushiRouter)
		owner = msg.sender;
	}

	/*
		token0 - Token we will borrow (i.e. DAI)
		token1 - Token we will trade token0 for (i.e. ETH)
		amount0 - Amount we're going to borrow
		amount1 - Will be 0 for now
		pairAddress - Address of the pair smart contract of UniSwap for the two tokens (address of the liquidity pool)
	*/
	function startArbitrage(address token0, address token1, uint amount0, uint amount1) external {
	    address pairAddress = IUniswapV2Factory(factory).getPair(token0, token1);
	    require(pairAddress != address(0), 'This pool does not exist');
	    IUniswapV2Pair(pairAddress).swap(amount0, amount1, address(this), bytes('not empty'));
	}

	/*
		_sender - The address that trigger the flash loan
		_amount0 - The amount borrowed (i.e. DAI)
		_amount1 - 0 (i.e. ETH)
		address - An array of addresses used to complete the trade
		amountToken - This will be equal to "_amount0"
		token0 - Address of the first token in UniSwap's liquidity pool
		token1 - Address of the second token in UniSwap's liquidity pool
		IERC20 token - A pointer to the token we're going to sell on SushiSwap
		amountRequired - The amount of the initial loan that must be reimbursed for the Flash loan to UniSwap

		Description: Borrow DAI on Uni -> Exchange DAI for ETH on Sushi -> Sell ETH for DAI on Uni
	*/
	function uniswapV2Call(address _sender, uint _amount0, uint _amount1, bytes calldata _data) external {
	    address[] memory path = new address[](2);
	    uint amountToken = _amount0 == 0 ? _amount1 : _amount0; // One of the amounts are 0, the other amount is what we want to borrow.
	    
	    address token0 = IUniswapV2Pair(msg.sender).token0();
	    address token1 = IUniswapV2Pair(msg.sender).token1();

	    require(msg.sender == UniswapV2Library.pairFor(factory, token0, token1), 'Unauthorized'); 
	    require(_amount0 == 0 || _amount1 == 0);

	    path[0] = _amount0 == 0 ? token1 : token0; // What we're going to borrow (i.e. DAI)
	    path[1] = _amount0 == 0 ? token0 : token1; // What we're going to buy with what's borrowed (i.e. ETH)

	    IERC20 token = IERC20(_amount0 == 0 ? token1 : token0); // (i.e. DAI because amount0 is not 0)
	    
	    token.approve(address(sushiRouter), amountToken); // Approve sushiRouter to spend (i.e. take DAI) certain amount of tokens (i.e. amountToken)

	    /* Given an output asset amount and an array of token addresses, calculates all preceding minimum input token amounts by calling getReserves for each pair of token addresses in the path in turn, and using these to call getAmountIn.
	    amountToken is the amount of DAI you get in exchange for ETH (in path[0]). That's how much is required.
	    */
	    uint amountRequired = UniswapV2Library.getAmountsIn(factory, amountToken, path)[0]; // (i.e. DAI needed to pay back loan; the amountRequired should be ETH)
	    /* Swaps an exact amount of input tokens for as many output tokens as possible, along the route determined by the path. 
	    The first element of path is the input token, the last is the output token, and any intermediate elements 
	    represent intermediate pairs to trade through (if, for example, a direct pair does not exist). 
		We take amountToken, which is the amount sushi is allowed to spend (i.e. DAI), amountRequired is the minimum amount of output tokens that must be received
		for transaction to NOT revert, we end up with ETH at the end of this line.
	    */
	    uint amountReceived = sushiRouter.swapExactTokensForTokens(amountToken, amountRequired, path, msg.sender, deadline)[1]; // We get ETH in return.

	    // We borrowed DAI, exchanged the DAI for ETH in amountReceived, and return back ETH (as the swap...)
	    IERC20 otherToken = IERC20(_amount0 == 0 ? token0 : token1); // (i.e. ETH)
	    otherToken.transfer(msg.sender, amountRequired); // Reimburse Loan in ETH
	    otherToken.transfer(tx.origin, amountReceived - amountRequired); // Keep Profit in ETH
  	}
}