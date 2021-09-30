// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

library NetworkFeesAndConfigs {

    function getDeadline(uint256 block_time) internal pure returns (uint) {
        return block_time + 30 seconds;
    }

    function getNetworkFeeTotal(uint256 current_fee_total, string memory network, uint amount) internal pure returns (uint256) {
        if(keccak256(abi.encodePacked(network)) == keccak256(abi.encodePacked("sushi")) || keccak256(abi.encodePacked(network)) == keccak256(abi.encodePacked("uniswap"))) {
            return current_fee_total + (amount * 30 / 10000); // Calculate Uniswap or SushiSwap's network fee of 0.30% for swaps.
        } else if(keccak256(abi.encodePacked(network)) == keccak256(abi.encodePacked("kyber"))) { 
            return current_fee_total + (amount * 25 / 10000); // Calculate Kyber's network fee of 0.25% for swaps.
        } else {
            return 0;
        }
    }
}
