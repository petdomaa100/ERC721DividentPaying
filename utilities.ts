import { ethers } from 'ethers';


const ether = (amount: number) => ethers.utils.parseEther(amount.toString());

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';



export { ether, NULL_ADDRESS, DEAD_ADDRESS };