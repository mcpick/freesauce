import { integer, text, real, sqliteTable, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const shops = sqliteTable('shops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  sauce_types: text('sauce_types').default('tomato'),
  submitted_by: text('submitted_by'),
  verified: integer('verified').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  suburb: text('suburb'),
  state: text('state'),
  slug: text('slug').unique(),
  photo_key: text('photo_key'),
  google_photo_key: text('google_photo_key'),
  google_place_id: text('google_place_id'),
});

export const votes = sqliteTable('votes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shop_id: integer('shop_id').notNull().references(() => shops.id),
  email: text('email').notNull(),
  vote: text('vote').notNull(), // 'up' or 'down'
  comment: text('comment'),
  status: text('status').notNull().default('pending'), // 'pending' or 'confirmed'
  token: text('token').notNull(),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  confirmed_at: text('confirmed_at'),
}, (table) => ({
  unique_shop_email: unique().on(table.shop_id, table.email),
}));