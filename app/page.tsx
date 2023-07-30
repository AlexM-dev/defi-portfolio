"use client";

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ChangeEvent } from 'react';

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"

import { privateKeyToAccount, PrivateKeyAccount } from 'viem/accounts'
import { parseAbi, createPublicClient, http, formatEther, parseEther, createWalletClient } from 'viem';
import { zkSync, Chain } from 'viem/chains';

interface WalletInfo {
  address: string,
  wallet: PrivateKeyAccount,

  hasRetrievalErrors: boolean,
  zkSyncEthBalance: bigint,
}

// Even though multicall3 provides a fn to get balance, viem stripped it off.
const multicallABI = parseAbi([
  'function getEthBalance(address addr) public view returns (uint256 balance)',
])

interface TransactionInfo {
  chain: Chain,
  status: "unknown" | "inProgress" | "reverted" | "success",
  hash: `0x${string}`,
  description: string | undefined,
}

async function sendOrbiterTxZksyncToArbitrum(wallet: PrivateKeyAccount, amount: string): Promise<`0x${string}`> {
  const zkSyncOrbiter = "0xee73323912a4e3772b74ed0ca1595a152b0ef282";
  const ending = 9002n;

  let amountToSendParsed = 0n;

  if (amount === "MAX") {
    const publicClient = createPublicClient({
      chain: zkSync,
      transport: http(),
    })
    const balance = (await publicClient.getBalance({ address: wallet.address }));
    const gasRequirements = await publicClient.estimateGas({
      account: wallet,
      value: balance,
      to: zkSyncOrbiter,
    })
    const gasPrice = await publicClient.getGasPrice()
    amountToSendParsed = (balance - gasPrice * gasRequirements) / 10000n * 10000n + ending;
  } else {
    amountToSendParsed = parseEther(amount) / 10000n * 10000n + ending;
  }

  if (amountToSendParsed < parseEther("0.05")) {
    throw "Orbiter: too low amount"
  }

  const wc = createWalletClient({
    account: wallet,
    chain: zkSync,
    transport: http(),
  })

  return await wc.sendTransaction({
    account: wallet,
    value: amountToSendParsed,
    to: zkSyncOrbiter,
  })
}

function RecentTransaction({ tx }: { tx: TransactionInfo }) {
  let txCol = '';
  switch (tx.status) {
    case "reverted":
      txCol = "text-red-600";
      break;
    case "success":
      txCol = "text-green-600";
      break;
    case "unknown":
      txCol = "text-grey-600";
      break;
    case "inProgress":
      txCol = "text-amber-600";
      break;
  }
  return (
    <a className={`${txCol} text-xs`}
      href={tx.chain.blockExplorers?.default.url + '/tx/' + tx.hash}>
      {tx.description || tx.hash}
    </a>)
}

interface ActionsState {
  orbiterZksyncArbitrumValue: string | undefined,
}

function WalletOverview({ walletInfo }: { walletInfo: WalletInfo }) {
  const [actionsState, setActionsState] = useState<ActionsState>(({} as ActionsState));
  const [recentTransactions, setRecentTransactions] = useState<TransactionInfo[]>([]);
  const getEtherWithPrecison = (eth: bigint, precision: number = 3) => {
    const formattedEther = formatEther(walletInfo.zkSyncEthBalance);
    const dotPos = formattedEther.indexOf(".");
    return formattedEther.substring(0, dotPos + 1 + precision);
  }

  useEffect(() => {
    const txUpdateInterval = 10000;
    const timerToken = setInterval(() => {
      recentTransactions
        .filter(tx => tx.status !== "success" && tx.status !== "reverted")
        .forEach(tx => {
          const publicClient = createPublicClient({
            chain: tx.chain,
            transport: http()
          })
          publicClient.getTransactionReceipt({ hash: tx.hash }).then(r => {
            const updatedTransactions = [...recentTransactions];
            for (const rtx of updatedTransactions) {
              if (rtx.hash !== r.transactionHash) continue;
              if (rtx.status === "reverted" || rtx.status === "success") return;
              rtx.status = r.status;
            }
            setRecentTransactions(updatedTransactions);
          }).catch(e => {
            console.error("Error", e, "on getting recipient")
          })
        })
    }, txUpdateInterval);
    return () => {
      clearInterval(timerToken);
    }
  }, [recentTransactions])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{`${walletInfo.address.substring(0, 6)}..${walletInfo.address.substring(walletInfo.address.length - 4)}`}</CardTitle>
        <CardDescription>{walletInfo.address}</CardDescription>
      </CardHeader>
      <CardContent>
        <h6 className="text-sm font-semibold">Last Txns</h6>
        {recentTransactions.length > 0 && (
          <div className="flex flex-col gap-1">
            {recentTransactions.map(t => (<RecentTransaction key={t.hash} tx={t} />))}
          </div>)
        }
        <p className="text-xs text-neutral-400">
          <a className="underline text-sky-500 decoration-sky-500 pr-2" href={`https://debank.com/profile/${walletInfo.address}/history`}>View on Debank</a>
          Become ambassador to see last transactions inline!
        </p>
        <p className="text-xs text-neutral-400">Status of the second transaction for bridging will be available for premium users.</p>
        <h6 className="text-sm font-semibold pt-2">Proxy</h6>
        <p className="text-xs text-neutral-400">Will be available for premium users.</p>
        <h6 className="text-sm font-semibold pt-2">Flow builder</h6>
        <p className="text-xs text-neutral-400">Will be available for premium users.</p>
        <h5 className="text-base font-semibold pt-4">Balances</h5>
        <div className="grid gap-2 grid-cols-2">
          <div>ZK Sync ERA ETH</div>
          <div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>{getEtherWithPrecison(walletInfo.zkSyncEthBalance)}</TooltipTrigger>
                <TooltipContent>
                  <p>RAW: {walletInfo.zkSyncEthBalance.toString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {/* ^ end of balances */}
        <h5 className="text-base font-semibold pt-4">Actions</h5>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-1.5">
            {/* TODO: sort actions wrt value */}
            <a>Orbiter.Finance <span className="text-xs text-neutral-400">ZKSync -&gt; Arbitrum</span></a>
            <Input className='w-24'
              placeholder={`~ ${getEtherWithPrecison(walletInfo.zkSyncEthBalance)}`}
              value={actionsState.orbiterZksyncArbitrumValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setActionsState({ ...actionsState, orbiterZksyncArbitrumValue: e.target.value })} />
            <Button variant="outline" onClick={() => setActionsState({ ...actionsState, orbiterZksyncArbitrumValue: "MAX" })}>Max</Button>
            <Button disabled={actionsState.orbiterZksyncArbitrumValue === undefined}
                    onClick={async () => {
              const txHash = await sendOrbiterTxZksyncToArbitrum(walletInfo.wallet, actionsState.orbiterZksyncArbitrumValue!)
              setRecentTransactions([
                {
                  chain: zkSync,
                  hash: txHash,
                  status: "inProgress",
                  description: `Orbiter: ZKSync -> Arbitrum, ${actionsState.orbiterZksyncArbitrumValue!} ETH`
                },
                ...recentTransactions
              ])
            }}>Run</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionName({ name }: { name: string }) {
  return (<div className="text-lg font-semibold mt-8">{name}</div>)
}

function WalletAction({ wallet }: { wallet: PrivateKeyAccount }) {
  return (
    <div className="flex flex-col">
      <span>{wallet.address}</span>
      <Button>Go</Button>
    </div>
  )
}

async function getMulticall3Balances(wallets: PrivateKeyAccount[], chainInfo: Chain) {
  if (!chainInfo?.contracts?.multicall3?.address) {
    throw "Multicall is not defined in chaininfo";
  }
  const multicallContract = {
    address: chainInfo.contracts.multicall3.address,
    abi: multicallABI,
  }
  const publicClient = createPublicClient({
    chain: chainInfo,
    transport: http()
  })
  return await publicClient.multicall({
    contracts: wallets.map(w => ({
      ...multicallContract,
      functionName: 'getEthBalance',
      args: [w.address]
    }))
  })
}

function DefiPortfolio({ wallets }: { wallets: PrivateKeyAccount[] }) {
  const [info, setInfo] = useState<WalletInfo[]>();

  useEffect(() => {
    const zkSyncBalances = getMulticall3Balances(wallets, zkSync);
    Promise.all([zkSyncBalances]).then(results => {
      const infos = (new Array(wallets.length).fill(0)).map((_, index) => ({
        address: wallets[index].address,
        wallet: wallets[index],

        hasRetrievalErrors: (results[0][index].status === "failure"),

        zkSyncEthBalance: (results[0][index].result || 0n)
      }))
      setInfo(infos)
    })
  }, [wallets]);

  return (
    <>
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        DeFi Portfolio
      </h1>
      <h2 className="mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
        Wallet View
      </h2>
      <div className="flex flex-wrap gap-1.5 pt-2">
        {info && info.map(w => (<WalletOverview walletInfo={w} key={w.address}></WalletOverview>))}
      </div>
      {/* <h2 className="mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
        Actions View
      </h2>
      <ActionName name="Orbiter" />
      <div className="flex flex-wrap gap-1.5 pt-2">
        {wallets.map(w => (<WalletAction wallet={w} key={`action-o-z-a-${w.address}`}></WalletAction>))}
      </div>
      <ActionName name="StarkNet" />
      <div className="flex flex-wrap gap-1.5 pt-2">
        {wallets.map(w => (<WalletAction wallet={w} key={`action-o-z-a-${w.address}`}></WalletAction>))}
      </div> */}
    </>
  )
}

// Sample key: d7403eb69ebef57aa9be59921efe29880e1e6cd300a8bbfc9323e0e6cfd4d9a2
type SetWalletsHandler = (wallets: PrivateKeyAccount[]) => void;

function WalletImporter({ setWallets }: { setWallets: SetWalletsHandler }) {
  const [keys, setKeys] = useState("")
  const getKeys = () => {
    return (keys.match(/[0-9A-Fa-f]{64}/g) || []).map(k => privateKeyToAccount(`0x${k}`));
  };

  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor="pk-input">Please, enter your private keys:</Label>
      <Textarea placeholder="0x0123456789abcdef...." id="pk-input" onChange={e => setKeys(e.target.value)} />
      <Button style={{ width: 'fit-content' }} onClick={() => setWallets(getKeys())}>OK</Button>
    </div>
  )
}

export default function Home() {
  const [wallets, setWallets] = useState<PrivateKeyAccount[]>([]);

  return (
    <main className="flex min-h-screen flex-col lg:p-24 p-0">
      {wallets.length > 0 ? (<DefiPortfolio wallets={wallets} />) : (<WalletImporter setWallets={setWallets} />)}
    </main>
  )
}

function Home_DEFAULT() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Get started by editing&nbsp;
          <code className="font-mono font-bold">app/page.tsx</code>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
            href="https://vercel.com?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            By{' '}
            <Image
              src="/vercel.svg"
              alt="Vercel Logo"
              className="dark:invert"
              width={100}
              height={24}
              priority
            />
          </a>
        </div>
      </div>

      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-blue-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px] z-[-1]">
        <Image
          className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert"
          src="/next.svg"
          alt="Next.js Logo"
          width={180}
          height={37}
          priority
        />
      </div>

      <div className="mb-32 grid text-center lg:mb-0 lg:grid-cols-4 lg:text-left">
        <a
          href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Docs{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Find in-depth information about Next.js features and API.
          </p>
        </a>

        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Learn{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Learn about Next.js in an interactive course with&nbsp;quizzes!
          </p>
        </a>

        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Templates{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Explore the Next.js 13 playground.
          </p>
        </a>

        <a
          href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Deploy{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Instantly deploy your Next.js site to a shareable URL with Vercel.
          </p>
        </a>
      </div>
    </main>
  )
}
