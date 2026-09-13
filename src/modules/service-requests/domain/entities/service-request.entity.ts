import { ServiceRequestStatus } from './service-request-status.enum';

export class ServiceRequest {
  private constructor(
    public readonly id: string,
    public readonly customerId: string,
    private _title: string,
    private _description: string,
    private _status: ServiceRequestStatus,
    private _skillIds: string[],
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    customerId: string,
    title: string,
    description: string,
  ): ServiceRequest {
    const now = new Date();

    return new ServiceRequest(
      crypto.randomUUID(),
      customerId,
      title,
      description,
      ServiceRequestStatus.OPEN,
      [],
      now,
      now,
    );
  }

  static reconstitute(
    id: string,
    customerId: string,
    title: string,
    description: string,
    status: ServiceRequestStatus,
    skillIds: string[],
    createdAt: Date,
    updatedAt: Date,
  ): ServiceRequest {
    return new ServiceRequest(
      id, customerId, title, description, status, skillIds, createdAt, updatedAt,
    );
  }

  get title(): string { return this._title; }
  get description(): string { return this._description; }
  get status(): ServiceRequestStatus { return this._status; }
  get skillIds(): string[] { return this._skillIds; }
  get updatedAt(): Date { return this._updatedAt; }

  addSkill(skillId: string): void {
    if (this._status !== ServiceRequestStatus.OPEN) {
      throw new Error('Cannot add skills after the request is no longer open');
    }
    if (this._skillIds.includes(skillId)) {
      return;
    }
    this._skillIds.push(skillId);
    this._updatedAt = new Date();
  }

  acceptOffer(): void {
    this.assertTransition(ServiceRequestStatus.OPEN, ServiceRequestStatus.OFFER_ACCEPTED);
    this._status = ServiceRequestStatus.OFFER_ACCEPTED;
    this._updatedAt = new Date();
  }

  startProgress(): void {
    this.assertTransition(ServiceRequestStatus.OFFER_ACCEPTED, ServiceRequestStatus.IN_PROGRESS);
    this._status = ServiceRequestStatus.IN_PROGRESS;
    this._updatedAt = new Date();
  }

  complete(): void {
    this.assertTransition(ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.COMPLETED);
    this._status = ServiceRequestStatus.COMPLETED;
    this._updatedAt = new Date();
  }

  cancel(): void {
    const cancellableFrom = [
      ServiceRequestStatus.OPEN,
      ServiceRequestStatus.OFFER_ACCEPTED,
    ];
    if (!cancellableFrom.includes(this._status)) {
      throw new Error(`Cannot cancel a request in status ${this._status}`);
    }
    this._status = ServiceRequestStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  expire(): void {
    this.assertTransition(ServiceRequestStatus.OPEN, ServiceRequestStatus.EXPIRED);
    this._status = ServiceRequestStatus.EXPIRED;
    this._updatedAt = new Date();
  }

  raiseDispute(): void {
    this.assertTransition(ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.DISPUTED);
    this._status = ServiceRequestStatus.DISPUTED;
    this._updatedAt = new Date();
  }

  private assertTransition(
    requiredCurrent: ServiceRequestStatus,
    target: ServiceRequestStatus,
  ): void {
    if (this._status !== requiredCurrent) {
      throw new Error(
        `Cannot transition from ${this._status} to ${target}; must be in ${requiredCurrent}`,
      );
    }
  }
}