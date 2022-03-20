import { waffle } from 'hardhat';
import { expect } from 'chai';

import { ether, NULL_ADDRESS } from '../utilities';
import Token from '../artifacts/contracts/DividentPayingNFT.sol/DividentPayingNFT.json';

import type { Contract, Wallet } from 'ethers';


describe('DividentPayingNFT contract', () => {
	const wallets = waffle.provider.getWallets();
	const [ owner, tokenHolder1, tokenHolder2, tokenHolder3, ...otherWallets ] = wallets;

	let token: Contract;
	let anyone: Wallet;


	async function expectDividentValues(address: string, accumulative: number, withdrawable: number, withdrawn: number) {
		const i = wallets.findIndex(wallet => wallet.address === address);
		const name = [ 'Owner', 'Holder 1', 'Holder 2', 'Holder 3', 'Random wallet' ][i];


		expect(
			await token.accumulativeDividendOf(address),
			`${name}'s accumulative dividend is incorrect`
		).to.equal(ether(accumulative));

		expect(
			await token.withdrawableDividendOf(address),
			`${name}'s withdrawable dividend is incorrect`
		).to.equal(ether(withdrawable));

		expect(
			await token.dividendOf(address),
			`${name}'s dividend is incorrect`
		).to.equal(ether(withdrawable));

		expect(
			await token.withdrawnDividendOf(address),
			`${name}'s withdrawn dividend is incorrect`
		).to.equal(ether(withdrawn));
	}


	beforeEach(async () => {
		token = await waffle.deployContract(owner, Token, []);

		anyone = otherWallets[ Math.floor(Math.random() * otherWallets.length) ];
	});


	describe('mint', () => {
		describe('when someone tries to mint 0 tokens', () => {
			it('reverts', async () => {
				await expect(
					token.mint(0)
				).to.be.revertedWith('DividentPayingNFT: invalid amount');
			});
		});

		describe('when someone tries to mint 1 token', () => {
			it('can mint tokens', async () => {
				await token.connect(tokenHolder1).mint(1);

				expect(
					await token.balanceOf(tokenHolder1.address)
				).to.equal(1);

				await expectDividentValues(tokenHolder1.address, 0, 0, 0);
			});
		});
	});

	describe('transferFrom', () => {
		beforeEach(async () => {
			await token.connect(tokenHolder1).mint(1);
		});


		describe('when the recipient is the zero address', () => {
			it('reverts', async () => {
				expect(
					token.connect(tokenHolder1).transferFrom(tokenHolder1, NULL_ADDRESS, 1)
				).to.be.revertedWith('ERC721: transfer to the zero address');
			});
		});

		describe('when the recipient is not the zero address', () => {
			describe('when the sender is not the owner nor apprived', () => {
				it('reverts', async () => {
					expect(
						token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder3.address, 1)
					).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
				});
			});

			describe('when the sender is the owner', () => {
				it('transfers the requested token', async () => {
					await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder2.address, 1);

					expect(
						await token.balanceOf(tokenHolder1.address),
						'Holder 1\'s token balance is incorrect'
					).to.equal(0);

					expect(
						await token.balanceOf(tokenHolder2.address),
						'Holder 2\'s token balance is incorrect'
					).to.equal(1);
				});

				it('emits the Transfer event', async () => {
					await expect(
						token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder2.address, 1),
						'Transferring a token doesn\'t emmit the Transfer event'
					).to.emit(token, 'Transfer').withArgs(tokenHolder1.address, tokenHolder2.address, 1);
				});
			});
		});
	});

	describe('distributeDividends', () => {
		describe('when anyone tries to distribute dividends', () => {
			describe('when the total supply is 0', () => {
				it('reverts', async () => {
					await expect(
						token.connect(anyone).distributeDividends({ value: ether(1) })
					).to.be.revertedWith('ERC721DividentPaying: total token supply is 0');
				});
			});

			describe('when paying 0 ether', () => {
				it('should succeed but nothing happens', async () => {
					await token.connect(tokenHolder1).mint(1);
					await token.connect(anyone).distributeDividends({ value: ether(0) });

					await expectDividentValues(tokenHolder1.address, 0, 0, 0);
				});
			});

			describe('when paying 1 ether and the total supply is above 0', () => {
				it('should distribute dividends to token holders', async () => {
					await token.connect(tokenHolder1).mint(1);
					await token.connect(tokenHolder2).mint(3);


					await expect(
						token.connect(anyone).distributeDividends({ value: ether(1) }),
						'distributeDividends() doesn\'t emmit the DividendsDistributed event'
					).to.emit(token, 'DividendsDistributed').withArgs(anyone.address, ether(1));

					await expectDividentValues(tokenHolder1.address, 0.25, 0.25, 0);

					await expectDividentValues(tokenHolder2.address, 0.75, 0.75, 0);
				});
			});
		});

		describe('when anyone tries to distribute dividends by sending ether to the contract', () => {
			describe('when the total supply is 0', () => {
				it('reverts', async () => {
					await expect(
						anyone.sendTransaction({ to: token.address, value: ether(1) })
					).to.revertedWith('ERC721DividentPaying: total token supply is 0');
				});
			});

			describe('when paying 0 ether', () => {
				it('should succeed but nothing happens', async () => {
					await token.connect(tokenHolder1).mint(1);
					await anyone.sendTransaction({ to: token.address, value: ether(0) })


					await expectDividentValues(tokenHolder1.address, 0, 0, 0);
				});
			});

			describe('when paying 1 ether and the total supply is above 0', () => {
				it('should distribute dividends to token holders', async () => {
					await token.connect(tokenHolder1).mint(1);
					await token.connect(tokenHolder2).mint(3);


					await expect(
						anyone.sendTransaction({ to: token.address, value: ether(1) }),
						'Sending ether doesn\'t emmit the DividendsDistributed event'
					).to.emit(token, 'DividendsDistributed').withArgs(anyone.address, ether(1));

					await expectDividentValues(tokenHolder1.address, 0.25, 0.25, 0);

					await expectDividentValues(tokenHolder2.address, 0.75, 0.75, 0);
				});
			});
		});
	});

	describe('withdrawDividend', () => {
		it('should be able to withdraw dividend', async () => {
			await token.connect(tokenHolder1).mint(1);
			await token.connect(tokenHolder2).mint(3);

			await token.connect(anyone).distributeDividends({ value: ether(1) });


			expect(
				await token.connect(tokenHolder1).withdrawDividend(),
				'Holder 1\'s balance didn\'t change by the correct amount'
			).to.changeEtherBalance(tokenHolder1, ether(0.25));

			await expectDividentValues(tokenHolder1.address, 0.25, 0, 0.25);

			expect(
				await token.connect(tokenHolder1).withdrawDividend(),
				'Holder 1\'s balance didn\'t change by the correct amount'
			).to.changeEtherBalance(tokenHolder1, 0);

			await expectDividentValues(tokenHolder1.address, 0.25, 0, 0.25);
		});

		it('should emit DividendWithdrawn event', async () => {
			await token.connect(tokenHolder1).mint(1);
			await token.connect(tokenHolder2).mint(3);

			await token.connect(anyone).distributeDividends({ value: ether(1) });


			await expect(
				token.connect(tokenHolder1).withdrawDividend(),
				'Withdrawing dividend doesn\'t emmit the DividendWithdrawn event'
			).to.emit(token, 'DividendWithdrawn').withArgs(tokenHolder1.address, ether(0.25));
		});

		describe('keep dividends unchanged in several cases', async () => {
			it('should keep dividends unchanged after minting tokens', async () => {
				await token.connect(tokenHolder1).mint(1);
				await token.connect(tokenHolder2).mint(3);


				await token.connect(anyone).distributeDividends({ value: ether(1) });

				await expectDividentValues(tokenHolder1.address, 0.25, 0.25, 0);

				await token.connect(tokenHolder1).mint(1);

				await expectDividentValues(tokenHolder1.address, 0.25, 0.25, 0);
			});

			it('should keep dividends unchanged after transferring tokens', async () => {
				await token.connect(tokenHolder1).mint(1);
				await token.connect(tokenHolder2).mint(3);


				await token.connect(anyone).distributeDividends({ value: ether(1) });

				await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder2.address, 1);

				await expectDividentValues(tokenHolder1.address, 0.25, 0.25, 0);

				await expectDividentValues(tokenHolder2.address, 0.75, 0.75, 0);
			});

			it('should correctly distribute dividends after transferring tokens', async () => {
				await token.connect(tokenHolder1).mint(2);
				await token.connect(tokenHolder2).mint(3);


				await token.connect(anyone).distributeDividends({ value: ether(5) });

				await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder2.address, 1);

				await token.connect(anyone).distributeDividends({ value: ether(50) });


				await expectDividentValues(tokenHolder1.address, 12, 12, 0);

				await expectDividentValues(tokenHolder2.address, 43, 43, 0);
			});
		});
	});

	describe('end-to-end', () => {
		it('should pass the end-to-end test', async () => {
			// Mint and distribute dividends

			await token.connect(tokenHolder1).mint(2); // 1 - 2
			await token.connect(anyone).distributeDividends({ value: ether(10) });

			await expectDividentValues(tokenHolder1.address, 10, 10, 0);


			// Transfer

			await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder2.address, 1);
			await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder2.address, 2);

			expect(
				await token.balanceOf(tokenHolder1.address),
				'Holder 1\'s balance is incorrect'
			).to.equal(0);

			expect(
				await token.balanceOf(tokenHolder2.address),
				'Holder 2\'s balance is incorrect'
			).to.equal(2);

			await expectDividentValues(tokenHolder1.address, 10, 10, 0);

			await expectDividentValues(tokenHolder2.address, 0, 0, 0);


			// tokenHolder1 withdraw

			expect(
				await token.connect(tokenHolder1).withdrawDividend(),
				'Holder 1\'s balance didn\'t change by the correct amount'
			).to.changeEtherBalance(tokenHolder1, ether(10));

			await expectDividentValues(tokenHolder1.address, 10, 0, 10);


			// Deposit

			await token.connect(anyone).distributeDividends({ value: ether(10) });

			await expectDividentValues(tokenHolder1.address, 10, 0, 10);

			await expectDividentValues(tokenHolder2.address, 10, 10, 0);


			// Mint

			await token.connect(tokenHolder1).mint(3); // 3 - 5

			expect(
				await token.balanceOf(tokenHolder1.address),
				'Holder 1\'s balance is incorrect'
			).to.equal(3);


			// Deposit

			await token.connect(anyone).distributeDividends({ value: ether(10) });

			await expectDividentValues(tokenHolder1.address, 16, 6, 10);

			await expectDividentValues(tokenHolder2.address, 14, 14, 0);


			// Transfers & mints 

			await token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder3.address, 1);
			await token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder3.address, 2);

			await token.connect(tokenHolder2).mint(4), // 6 - 9
			await token.connect(tokenHolder3).mint(1)  // 10

			await token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder1.address, 6);
			await token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder1.address, 7);

			await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder3.address, 3);
			await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder3.address, 4);
			await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder3.address, 5);
			await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder3.address, 6);
			await token.connect(tokenHolder1).transferFrom(tokenHolder1.address, tokenHolder3.address, 7);

			await token.connect(tokenHolder3).transferFrom(tokenHolder3.address, tokenHolder2.address, 4);
			await token.connect(tokenHolder3).transferFrom(tokenHolder3.address, tokenHolder2.address, 6);

			await token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder1.address, 4);
			await token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder1.address, 6);
			await token.connect(tokenHolder2).transferFrom(tokenHolder2.address, tokenHolder1.address, 8);

			expect(
				await token.balanceOf(tokenHolder1.address),
				'Holder 1\'s balance is incorrect'
			).to.equal(3);

			expect(
				await token.balanceOf(tokenHolder2.address),
				'Holder 2\'s balance is incorrect'
			).to.equal(1);

			expect(
				await token.balanceOf(tokenHolder3.address),
				'Holder 3\'s balance is incorrect'
			).to.equal(6);


			// Deposit

			await token.connect(anyone).distributeDividends({ value: ether(10) });

			await expectDividentValues(tokenHolder1.address, 19, 9, 10);

			await expectDividentValues(tokenHolder2.address, 15, 15, 0);

			await expectDividentValues(tokenHolder3.address, 6, 6, 0);


			// tokenHolder1 withdraw

			expect(
				await token.connect(tokenHolder1).withdrawDividend(),
				'Holder 1\'s balance didn\'t change by the correct amount'
			).to.changeEtherBalance(tokenHolder1, ether(9));

			await expectDividentValues(tokenHolder1.address, 19, 0, 19);


			// tokenHolder2 withdraw

			expect(
				await token.connect(tokenHolder2).withdrawDividend(),
				'Holder 2\'s balance didn\'t change by the correct amount'
			).to.changeEtherBalance(tokenHolder2, ether(15));

			await expectDividentValues(tokenHolder2.address, 15, 0, 15);


			// tokenHolder3 withdraw

			expect(
				await token.connect(tokenHolder3).withdrawDividend(),
				'Holder 3\'s balance didn\'t change by the correct amount'
			).to.changeEtherBalance(tokenHolder3, ether(6));

			await expectDividentValues(tokenHolder3.address, 6, 0, 6);
		});
	});
});