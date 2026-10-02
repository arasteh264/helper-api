// customers/domain/entities/customer-profile.entity.ts
import { randomUUID } from 'crypto';

export class CustomerProfile {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly createdAt: Date,
  ) {}

  static create(userId: string): CustomerProfile {
    return new CustomerProfile(randomUUID(), userId, new Date());
  }

  static reconstitute(props: {
    id: string;
    userId: string;
    createdAt: Date;
  }): CustomerProfile {
    return new CustomerProfile(props.id, props.userId, props.createdAt);
  }
}