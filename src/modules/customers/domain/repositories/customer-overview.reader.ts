// domain/repositories/customer-overview.reader.ts
export interface CustomerOverviewData {
  name: string;
  memberSince: Date;
  activeRequests: number;
  completedJobs: number;
  addressesCount: number;
}

export interface CustomerOverviewReader {
  read(userId: string): Promise<CustomerOverviewData>;
}