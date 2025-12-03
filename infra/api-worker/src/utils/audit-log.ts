import type { Env } from '../types'
import { logInfo } from './logging'

/**
 * Audit log action types
 */
export enum AuditActionType {
  // Order actions
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  ORDER_REFUNDED = 'ORDER_REFUNDED',
  ORDER_PAID = 'ORDER_PAID',
  ORDER_FULFILLED = 'ORDER_FULFILLED',
  
  // Admin account actions
  ADMIN_CREATED = 'ADMIN_CREATED',
  ADMIN_DELETED = 'ADMIN_DELETED',
  ADMIN_ROLE_CHANGED = 'ADMIN_ROLE_CHANGED',
  ADMIN_STATUS_CHANGED = 'ADMIN_STATUS_CHANGED', // is_active changes
  
  // User actions
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED = 'USER_STATUS_CHANGED',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  action: AuditActionType
  actorId: number | null // adminId or userId who performed the action
  actorType: 'admin' | 'user' | 'system'
  targetEntity: string // e.g., 'order', 'user', 'admin'
  targetId: number | string
  requestId?: string
  metadata?: Record<string, any> // Additional context (old value, new value, reason, etc.)
  timestamp: number
}

/**
 * Create an audit log entry
 * 
 * @param action - Type of action being logged
 * @param actorId - ID of the user/admin who performed the action (null for system actions)
 * @param actorType - Type of actor ('admin', 'user', or 'system')
 * @param targetEntity - Entity type being acted upon (e.g., 'order', 'user')
 * @param targetId - ID of the target entity
 * @param requestId - Request ID from context (optional)
 * @param metadata - Additional metadata (old/new values, reason, etc.)
 * @param env - Environment for logging
 */
export function logAuditEvent(
  action: AuditActionType,
  actorId: number | null,
  actorType: 'admin' | 'user' | 'system',
  targetEntity: string,
  targetId: number | string,
  requestId?: string,
  metadata?: Record<string, any>,
  env?: Env
): void {
  const auditEntry: AuditLogEntry = {
    action,
    actorId,
    actorType,
    targetEntity,
    targetId,
    requestId,
    metadata,
    timestamp: Math.floor(Date.now() / 1000),
  }

  // Log as structured info message
  logInfo(`[AUDIT] ${action}`, {
    audit: auditEntry,
  }, env)
}

/**
 * Helper: Log order status change
 */
export function logOrderStatusChange(
  orderId: number,
  oldStatus: string,
  newStatus: string,
  actorId: number | null,
  actorType: 'admin' | 'user' | 'system',
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ORDER_STATUS_CHANGED,
    actorId,
    actorType,
    'order',
    orderId,
    requestId,
    {
      oldStatus,
      newStatus,
    },
    env
  )
}

/**
 * Helper: Log order refund
 */
export function logOrderRefund(
  orderId: number,
  refundId: number,
  refundAmount: number,
  reason: string | null,
  actorId: number | null,
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ORDER_REFUNDED,
    actorId,
    'admin', // Only admins can refund
    'order',
    orderId,
    requestId,
    {
      refundId,
      refundAmount,
      reason: reason || null,
    },
    env
  )
}

/**
 * Helper: Log order payment
 */
export function logOrderPaid(
  orderId: number,
  paymentId: number,
  amount: number,
  actorId: number | null,
  actorType: 'admin' | 'user' | 'system',
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ORDER_PAID,
    actorId,
    actorType,
    'order',
    orderId,
    requestId,
    {
      paymentId,
      amount,
    },
    env
  )
}

/**
 * Helper: Log order fulfillment
 */
export function logOrderFulfilled(
  orderId: number,
  actorId: number | null,
  actorType: 'admin' | 'user' | 'system',
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ORDER_FULFILLED,
    actorId,
    actorType,
    'order',
    orderId,
    requestId,
    {},
    env
  )
}

/**
 * Helper: Log admin account creation
 */
export function logAdminCreated(
  adminId: number,
  email: string,
  createdBy: number | null, // Admin who created this account (null for seed)
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ADMIN_CREATED,
    createdBy,
    createdBy ? 'admin' : 'system',
    'admin',
    adminId,
    requestId,
    {
      email,
    },
    env
  )
}

/**
 * Helper: Log admin account deletion
 */
export function logAdminDeleted(
  adminId: number,
  email: string,
  deletedBy: number,
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ADMIN_DELETED,
    deletedBy,
    'admin',
    'admin',
    adminId,
    requestId,
    {
      email,
    },
    env
  )
}

/**
 * Helper: Log admin role change
 */
export function logAdminRoleChange(
  adminId: number,
  oldRole: string,
  newRole: string,
  changedBy: number,
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ADMIN_ROLE_CHANGED,
    changedBy,
    'admin',
    'admin',
    adminId,
    requestId,
    {
      oldRole,
      newRole,
    },
    env
  )
}

/**
 * Helper: Log admin status change (is_active)
 */
export function logAdminStatusChange(
  adminId: number,
  oldStatus: boolean,
  newStatus: boolean,
  changedBy: number,
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.ADMIN_STATUS_CHANGED,
    changedBy,
    'admin',
    'admin',
    adminId,
    requestId,
    {
      oldStatus,
      newStatus,
    },
    env
  )
}

/**
 * Helper: Log user role change
 */
export function logUserRoleChange(
  userId: number,
  oldRole: string,
  newRole: string,
  changedBy: number,
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.USER_ROLE_CHANGED,
    changedBy,
    'admin',
    'user',
    userId,
    requestId,
    {
      oldRole,
      newRole,
    },
    env
  )
}

/**
 * Helper: Log user status change (is_active)
 */
export function logUserStatusChange(
  userId: number,
  oldStatus: boolean,
  newStatus: boolean,
  changedBy: number,
  requestId?: string,
  env?: Env
): void {
  logAuditEvent(
    AuditActionType.USER_STATUS_CHANGED,
    changedBy,
    'admin',
    'user',
    userId,
    requestId,
    {
      oldStatus,
      newStatus,
    },
    env
  )
}

