// SPDX-License-Identifier: Unlicense

pragma solidity 0.8.12;

import "./ERC721DividentPaying.sol";


contract DividentPayingNFT is ERC721DividentPaying {
	uint256 public maxSupply;


	constructor() ERC721DividentPaying("Divident Paying NFT", "DPN") {
		maxSupply = 100;
	}


	function mint(uint256 amount) external {
		require(amount > 0, "DividentPayingNFT: invalid amount");


		uint256 supply = totalSupply();

		require(supply + amount <= maxSupply, "DividentPayingNFT: max supply exceeded");


		for (uint256 i = 1; i <= amount; i++) {
			_mint(_msgSender(), supply + i);
		}
	}
}