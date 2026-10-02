// domain/entities/customer-wallet.entity.ts
export class CustomerWallet {
  private constructor(
    public readonly id: string,
    public readonly customerProfileId: string,
    public readonly balance: number,
    public readonly totalSpent: number,
  ) {}

  static reconstitute(props: {
    id: string;
    customerProfileId: string;
    balance: number;
    totalSpent: number;
  }): CustomerWallet {
    return new CustomerWallet(
      props.id,
      props.customerProfileId,
      props.balance,
      props.totalSpent,
    );
  }
}