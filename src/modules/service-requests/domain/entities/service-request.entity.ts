import { PreferredTime } from './preferred-time.enum';
import { ServiceRequestStatus } from './service-request-status.enum';
export class ServiceRequest {
  private constructor(
    public readonly id: string,
    public readonly customerId: string,
    private _title: string,
    private _description: string,
    private _status: ServiceRequestStatus,
    private _skillIds: string[],
    private _address: string | null,
    private _latitude: number | null,
    private _longitude: number | null,
    private _budgetMin: number | null,
    private _budgetMax: number | null,
    private _preferredTime: PreferredTime | null,
    private _imageIds: string[],
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
      null,
      null,
      null,
      null,
      null,
      null,
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
    address: string | null,
    latitude: number | null,
    longitude: number | null,
    budgetMin: number | null,
    budgetMax: number | null,
    preferredTime: PreferredTime | null,
    imageIds: string[],
    createdAt: Date,
    updatedAt: Date,
  ): ServiceRequest {
    return new ServiceRequest(
      id,
      customerId,
      title,
      description,
      status,
      skillIds,
      address,
      latitude,
      longitude,
      budgetMin,
      budgetMax,
      preferredTime,
      imageIds,
      createdAt,
      updatedAt,
    );
  }

  get title(): string {
    return this._title;
  }
  get description(): string {
    return this._description;
  }
  get status(): ServiceRequestStatus {
    return this._status;
  }
  get skillIds(): string[] {
    return this._skillIds;
  }
  get address(): string | null {
    return this._address;
  }
  get latitude(): number | null {
    return this._latitude;
  }
  get longitude(): number | null {
    return this._longitude;
  }
  get budgetMin(): number | null {
    return this._budgetMin;
  }
  get budgetMax(): number | null {
    return this._budgetMax;
  }
  get preferredTime(): PreferredTime | null {
    return this._preferredTime;
  }
  get imageIds(): string[] {
    return this._imageIds;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  setLocation(address: string, latitude: number, longitude: number): void {
    this._address = address;
    this._latitude = latitude;
    this._longitude = longitude;
    this._updatedAt = new Date();
  }

  setBudget(min: number, max: number): void {
    if (min > max) {
      throw new Error('budgetMin cannot be greater than budgetMax');
    }
    this._budgetMin = min;
    this._budgetMax = max;
    this._updatedAt = new Date();
  }

  setPreferredTime(preferredTime: PreferredTime): void {
    this._preferredTime = preferredTime;
    this._updatedAt = new Date();
  }

  addImage(imageId: string): void {
    this._imageIds.push(imageId);
    this._updatedAt = new Date();
  }

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
    this.assertTransition(
      ServiceRequestStatus.OPEN,
      ServiceRequestStatus.OFFER_ACCEPTED,
    );
    this._status = ServiceRequestStatus.OFFER_ACCEPTED;
    this._updatedAt = new Date();
  }

  startProgress(): void {
    this.assertTransition(
      ServiceRequestStatus.OFFER_ACCEPTED,
      ServiceRequestStatus.IN_PROGRESS,
    );
    this._status = ServiceRequestStatus.IN_PROGRESS;
    this._updatedAt = new Date();
  }

  complete(): void {
    this.assertTransition(
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.COMPLETED,
    );
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
    this.assertTransition(
      ServiceRequestStatus.OPEN,
      ServiceRequestStatus.EXPIRED,
    );
    this._status = ServiceRequestStatus.EXPIRED;
    this._updatedAt = new Date();
  }

  raiseDispute(): void {
    this.assertTransition(
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.DISPUTED,
    );
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
