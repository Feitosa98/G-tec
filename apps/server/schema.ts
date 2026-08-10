import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

// -------------------------------------------------------------
// CONTROL DATABASE SCHEMA
// -------------------------------------------------------------
export const tenants = pgTable('tenants', {
    id: text('id').primaryKey(),
    storeSlug: text('store_slug').notNull().unique(),
    databaseName: text('database_name').notNull().unique(),
    profile: jsonb('profile').notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------
// STORE DATABASE SCHEMA
// -------------------------------------------------------------
export const users = pgTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    username: text('username').notNull().unique(),
    email: text('email'),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const createCollectionTable = (name: string) => pgTable(name, {
    id: text('id').primaryKey(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const products = createCollectionTable('products');
export const sales = createCollectionTable('sales');
export const expenses = createCollectionTable('expenses');
export const customers = createCollectionTable('customers');
export const receivables = createCollectionTable('receivables');
export const services = createCollectionTable('services');
export const serviceOrders = createCollectionTable('service_orders');
export const subscriptions = createCollectionTable('subscriptions');
export const integrations = createCollectionTable('integrations');
export const paymentTransactions = createCollectionTable('payment_transactions');
export const suppliers = createCollectionTable('suppliers');
export const stockMovements = createCollectionTable('stock_movements');
export const appointments = createCollectionTable('appointments');
export const auditLogs = createCollectionTable('audit_log');
