import * as crypto from 'crypto'

const ALGORITHM = {
  SHA256: 'SHA256',
  MD5: 'MD5'
}

class Transaction {
  constructor (
    public amount: number,
    public payerKey: string,
    public payeeKey: string,
  ) { }

  toJson () {
    return JSON.stringify(this)
  }
}

class Block {
  public nounce = Math.round(Math.random() * 100_000_000)

  constructor (
    public prevHash: string,
    public transaction: Transaction,
    public timeMs = Date.now()
  ) { }

  get hash () {
    const json = this.toJson()
    const hash = crypto.createHash(ALGORITHM.SHA256)

    hash.update(json).end()

    return hash.digest('hex')
  }

  toJson () {
    return JSON.stringify(this)
  }
}

class Chain {
  public static instance: Chain
  public static founder: string

  blocks: Block[]

  constructor () {
    this.blocks = [
      new Block(null, new Transaction(100, 'genesis', Chain.founder))
    ]
  }

  get lastBlock () {
    return this.blocks[this.blocks.length - 1]
  }

  addBlock (transaction: Transaction, signature: Buffer) {
    const verifier = crypto.createVerify(ALGORITHM.SHA256)
    verifier.update(transaction.toJson())

    const isSigned = verifier.verify(transaction.payerKey, signature)

    if (!isSigned) {
      console.info(`FAILED: Transaction NOT signed...!`)
      return
    }

    const senderWallet = Wallet.allWallets.find(wallet => wallet.publicKey === transaction.payerKey)
    const isValid = senderWallet.ballance() - transaction.amount > 0

    if (!isValid) {
      console.info(`FAILED: ${senderWallet.nickName} DOESN'T have enough money (₿${transaction.amount}) to send...!`)
      return
    }

    const nextBlock = new Block(this.lastBlock.hash, transaction)
    this.mine(nextBlock.nounce)
    this.blocks.push(nextBlock)
  }

  mine (nounce: number) {
    let solution = 1
    console.info(`Started mining for ${nounce}`)

    while (true) {
      const hash = crypto.createHash(ALGORITHM.MD5)
      hash.update((nounce + solution).toString()).end()

      const digest = hash.digest('hex')

      if (digest.startsWith('0000')) {
        console.info(`Solved: ${solution}`)
        return solution
      }

      solution += 1
    }
  }
}

class Wallet {
  public nickName: string
  public publicKey: string
  private privateKey: string
  public static allWallets: Wallet[] = []

  constructor (nickName: string) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa' as any, {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })

    this.privateKey = privateKey as unknown as string
    this.publicKey = publicKey as unknown as string
    this.nickName = nickName

    Wallet.allWallets.push(this)
  }

  sendCoin (amount: number, payeeKey: string) {
    const transaction = new Transaction(amount, this.publicKey, payeeKey)

    const sign = crypto.createSign(ALGORITHM.SHA256)
    sign.update(transaction.toJson()).end()

    const signature = sign.sign(this.privateKey)
    Chain.instance.addBlock(transaction, signature)
  }

  ballance () {
    const earned = Chain.instance.blocks
      .filter((block) => block.transaction.payeeKey === this.publicKey)
      .reduce((prev, val) => prev + val.transaction.amount, 0)

    const spent = Chain.instance.blocks
      .filter((block) => block.transaction.payerKey === this.publicKey)
      .reduce((prev, val) => prev + val.transaction.amount, 0)

    return earned - spent
  }

  toString () {
    return `${this.nickName} has ₿${this.ballance()}`
  }
}

const hbpWallet = new Wallet('hbp')

Chain.founder = hbpWallet.publicKey
Chain.instance = new Chain()

const bobWallet = new Wallet('bob')
const aliceWallet = new Wallet('alice')

hbpWallet.sendCoin(20, bobWallet.publicKey)
hbpWallet.sendCoin(30, aliceWallet.publicKey)
hbpWallet.sendCoin(40, aliceWallet.publicKey)
hbpWallet.sendCoin(50, aliceWallet.publicKey)
hbpWallet.sendCoin(60, aliceWallet.publicKey)

aliceWallet.sendCoin(15, hbpWallet.publicKey)

console.info(hbpWallet.toString())
console.info(bobWallet.toString())
console.info(aliceWallet.toString())
