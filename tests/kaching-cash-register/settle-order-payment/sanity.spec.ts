import { findTokenCashboxPDA, OrderItemOperation } from "../../../sdk/ts";
import {
  mockCashierOrderService,
  anOrder,
  settleOrderPayment,
} from "../../utils/settle-payment";
import { confirmTransaction, setupCurrency } from "../../utils/solana";
import { createTokenCashbox } from "../../utils/token-cashbox";
import { registerSettleOrderPaymentTest } from "./runner";

registerSettleOrderPaymentTest("should settle a payment", async (env) => {
  const { utils, fundWallet, currency } = await setupCurrency();
  const tokenCashbox = await createTokenCashbox({
    currency,
    cashier: env.cashier,
    cashRegisterId: env.cashRegisterId,
  });
  await Promise.all([
    fundWallet(tokenCashbox, 2),
    fundWallet(env.customer.publicKey, 2),
  ]);
  const orderItems = [
    {
      amount: utils.calculateAmountInDecimals(1),
      currency,
      op: OrderItemOperation.DEBIT_CUSTOMER,
    },
  ];
  const { serializedOrder, signature } = mockCashierOrderService(
    env.cashier,
    anOrder({
      cashRegisterId: env.cashRegisterId,
      customer: env.customer.publicKey,
      items: orderItems,
    })
  );

  try {
    const tx = await settleOrderPayment({
      cashRegister: env.cashRegister,
      cashRegisterId: env.cashRegisterId,
      cashRegisterBump: env.cashRegisterBump,
      serializedOrder,
      signature,
      signerPublicKey: env.cashier.publicKey,
      customer: env.customer,
      orderItems,
    });
    await confirmTransaction(tx);
  } catch (error) {
    console.info(error.logs);
    throw new Error(`expected tx to succeed, but error was thrown`);
  }
  const [customerBalance, tokenCashboxBalance] = await Promise.all([
    utils.getMintBalanceForWallet(env.customer.publicKey),
    utils.getMintBalanceForWallet(tokenCashbox),
  ]);
  expect(customerBalance.toString()).toEqual(
    String(utils.calculateAmountInDecimals(1))
  );
  expect(tokenCashboxBalance.toString()).toEqual(
    String(utils.calculateAmountInDecimals(3))
  );
});
