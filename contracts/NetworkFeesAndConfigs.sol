// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

library NetworkFeesAndConfigs {

    function getDeadline() public pure returns (uint) {
        return 30 seconds;
    }

    function getNetworkFeeTotal(string memory network, uint amount) public pure returns (uint) {
        if(keccak256(abi.encodePacked(network)) == keccak256(abi.encodePacked("sushi"))) {
            return amount * 30 / 100; // Calculate Uniswap or SushiSwap's network fee for swaps. 
        } else if(keccak256(abi.encodePacked(network)) == keccak256(abi.encodePacked("kyber"))) { 
            return amount * 25 / 100; // Calculate Kyber's network fee for swaps.
        }
    }
}
