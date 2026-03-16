import {
  pgTable, uuid, varchar, text, decimal,
  boolean, integer, timestamp, jsonb, pgEnum
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// --- ENUMS ---
export const roleEnum = pgEnum('role', ['customer', 'vendor_staff', 'system_admin'])
export const statusEnum = pgEnum('tenant_status', ['active', 'inactive'])
export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'received', 'preparing', 'ready', 'completed', 'cancelled'
])
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid', 'refunded', 'failed'])

// --- TENANTS (Vendors/Restaurants) ---
export const tenants = pgTable('tenants', {
  id:         uuid('id').primaryKey().defaultRandom(),
  slug:       varchar('slug', { length: 50 }).notNull().unique(),
  name:       varchar('name', { length: 100 }).notNull(),
  logoUrl:    varchar('logo_url', { length: 255 }),
  bannerUrl:  varchar('banner_url', { length: 255 }),
  themeColor: varchar('theme_color', { length: 7 }), // Hex color code e.g., #FF5733
  status:     statusEnum('status').default('active').notNull(),
  config:     jsonb('config'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  menus: many(menus),
  categories: many(categories),
  tables: many(tables),
  menuItems: many(menuItems),
  orders: many(orders),
}))

// --- USERS ---
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').references(() => tenants.id),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role:         roleEnum('role').notNull(),
  name:         varchar('name', { length: 100 }),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}))

// --- MENUS ---
export const menus = pgTable('menus', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  name:         varchar('name', { length: 100 }).notNull(),
  translations: jsonb('translations'), // Multilingual support e.g. { "es": { "name": "Cena" } }
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

export const menusRelations = relations(menus, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [menus.tenantId],
    references: [tenants.id],
  }),
  menuItems: many(menuItems),
}))

// --- CATEGORIES ---
export const categories = pgTable('categories', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  name:         varchar('name', { length: 100 }).notNull(),
  translations: jsonb('translations'), // Multilingual support
  sortOrder:    integer('sort_order').default(0),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  menuItems: many(menuItems),
}))

// --- TABLES (Physical Restaurant Tables) ---
export const tables = pgTable('tables', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  name:        varchar('name', { length: 50 }).notNull(), // e.g., "Table 1", "Patio 4"
  qrCodeUrl:   varchar('qr_code_url', { length: 255 }),
  isActive:    boolean('is_active').default(true).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

export const tablesRelations = relations(tables, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tables.tenantId],
    references: [tenants.id],
  }),
  orders: many(orders),
}))

// --- MENU ITEMS ---
export const menuItems = pgTable('menu_items', {
  id:           uuid('id').primaryKey().defaultRandom(),
  menuId:       uuid('menu_id').notNull().references(() => menus.id),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  categoryId:   uuid('category_id').references(() => categories.id), // Link to category
  name:         varchar('name', { length: 100 }).notNull(),
  description:  text('description'),
  translations: jsonb('translations'), // Multilingual support e.g. { "es": { "name": "Taco", "description": "Delicioso taco" } }
  price:        decimal('price', { precision: 10, scale: 2 }).notNull(),
  imageUrl:     varchar('image_url', { length: 255 }),
  options:      jsonb('options'),
  isAvailable:  boolean('is_available').default(true).notNull(),
  sortOrder:    integer('sort_order').default(0),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  menu: one(menus, {
    fields: [menuItems.menuId],
    references: [menus.id],
  }),
  tenant: one(tenants, {
    fields: [menuItems.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}))

// --- ORDERS ---
export const orders = pgTable('orders', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id),
  tableId:          uuid('table_id').references(() => tables.id), // Physical table origin
  guestName:        varchar('guest_name', { length: 100 }),
  guestSession:     uuid('guest_session'),
  status:           orderStatusEnum('status').default('pending').notNull(),
  paymentStatus:    paymentStatusEnum('payment_status').default('unpaid').notNull(),
  paymentReference: varchar('payment_reference', { length: 255 }),
  totalAmount:      decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  itemsSnapshot:    jsonb('items_snapshot').notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
})

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  orderItems: many(orderItems),
}))

// --- ORDER ITEMS ---
export const orderItems = pgTable('order_items', {
  id:              uuid('id').primaryKey().defaultRandom(),
  orderId:         uuid('order_id').notNull().references(() => orders.id),
  menuItemId:      uuid('menu_item_id').notNull().references(() => menuItems.id),
  quantity:        integer('quantity').notNull(),
  unitPrice:       decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  selectedOptions: jsonb('selected_options'),
})

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}))

