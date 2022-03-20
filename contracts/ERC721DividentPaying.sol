// SPDX-License-Identifier: Unlicense

pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./IERC721DividendPaying.sol";


contract ERC721DividentPaying is ERC721, IERC721DividendPaying {
	uint256 private _totalSupply;
	uint256 private _dividendPerShare;

	mapping(address => int256) private _dividendCorrections;
	mapping(address => uint256) private _withdrawnDividends;


	constructor(string memory name, string memory symbol) ERC721(name, symbol) {
		_totalSupply = 0;
		_dividendPerShare = 0;
	}


	function distributeDividends() public payable {
		require(totalSupply() > 0, "ERC721DividentPaying: total token supply is 0");

		if (msg.value > 0) {
			_dividendPerShare += msg.value / totalSupply();

			emit DividendsDistributed(_msgSender(), msg.value);
		}
	}

	function withdrawDividend() public {
		uint256 withdrawableDividend = withdrawableDividendOf(_msgSender());

		if (withdrawableDividend > 0) {
			_withdrawnDividends[_msgSender()] += withdrawableDividend;

			emit DividendWithdrawn(_msgSender(), withdrawableDividend);

			(bool success, ) = payable(_msgSender()).call{ value: withdrawableDividend }("");
			require(success, "ERC721DividentPaying: failed to transfer withdrawable dividend");
		}
	}


	function dividendOf(address owner) public view returns(uint256) {
		return withdrawableDividendOf(owner);
	}

	function withdrawableDividendOf(address owner) public view returns(uint256) {
		return accumulativeDividendOf(owner) - _withdrawnDividends[owner];
	}

	function accumulativeDividendOf(address owner) public view returns(uint256) {
		uint256 totalDividendOfOwner = _dividendPerShare * balanceOf(owner);
		int256 accumulativeDividendOfOwner = int256(totalDividendOfOwner) + _dividendCorrections[owner];

		require(accumulativeDividendOfOwner >= 0);

		return uint256(accumulativeDividendOfOwner);
	}

	function withdrawnDividendOf(address owner) public view returns(uint256) {
		return _withdrawnDividends[owner];
	}

	function totalSupply() public view returns(uint256) {
		return _totalSupply;
	}


	function _mint(address to, uint256 tokenID) internal override {
		super._mint(to, tokenID);

		_totalSupply++;

		_dividendCorrections[to] -= int256(_dividendPerShare);
	}

	function _burn(uint256 tokenID) internal override {
		address owner = ownerOf(tokenID);

		super._burn(tokenID);

		_totalSupply--;

		_dividendCorrections[owner] += int256(_dividendPerShare);
	}

	function _transfer(address from, address to, uint256 tokenID) internal override {
		super._transfer(from, to, tokenID);

		int256 correction = int256(_dividendPerShare);

		_dividendCorrections[from] += correction;
		_dividendCorrections[to] -= correction;
	}


	receive() external payable {
		distributeDividends();
	}
}