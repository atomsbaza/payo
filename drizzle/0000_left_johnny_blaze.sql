CREATE TABLE "link_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payer_address" text,
	"tx_hash" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" text NOT NULL,
	"owner_address" text NOT NULL,
	"recipient" text NOT NULL,
	"token" text NOT NULL,
	"chain_id" integer NOT NULL,
	"amount" text,
	"memo" text,
	"expires_at" timestamp with time zone,
	"signature" text NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"pay_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_links_link_id_unique" UNIQUE("link_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_log" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limit_log_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tx_hash" text NOT NULL,
	"chain_id" integer NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"value" text NOT NULL,
	"token_symbol" text,
	"token_decimal" integer,
	"contract_address" text,
	"direction" text NOT NULL,
	"block_number" bigint,
	"timestamp" timestamp with time zone NOT NULL,
	"is_error" boolean DEFAULT false NOT NULL,
	"raw_data" jsonb,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_tx_hash_chain_id_direction_unique" UNIQUE("tx_hash","chain_id","direction")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"ens_name" text,
	"ens_cached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_address_unique" UNIQUE("address")
);
--> statement-breakpoint
ALTER TABLE "link_events" ADD CONSTRAINT "link_events_link_id_payment_links_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."payment_links"("link_id") ON DELETE cascade ON UPDATE no action;