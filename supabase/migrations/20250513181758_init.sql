create sequence "public"."cards_id_seq";

create table "public"."cards" (
    "id" integer not null default nextval('cards_id_seq'::regclass),
    "loopy_id" text not null,
    "campaign_id" text not null,
    "status" text not null,
    "current_stamps" integer default 0,
    "total_stamps_earned" integer default 0,
    "total_rewards_earned" integer default 0,
    "total_rewards_redeemed" integer default 0,
    "last_stamp_earned" timestamp without time zone,
    "last_reward_earned" timestamp without time zone,
    "last_reward_redeemed" timestamp without time zone,
    "expiry_date" timestamp without time zone,
    "created" timestamp without time zone not null default now(),
    "updated" timestamp without time zone not null default now(),
    "data_consent_opt_in" boolean default false,
    "email" text not null,
    "first_name" text,
    "last_name" text,
    "mobile_number" text,
    "postcode" text,
    "date_of_birth" date
);


alter sequence "public"."cards_id_seq" owned by "public"."cards"."id";

CREATE UNIQUE INDEX cards_loopy_id_key ON public.cards USING btree (loopy_id);

CREATE UNIQUE INDEX cards_pkey ON public.cards USING btree (id);

CREATE INDEX idx_cards_campaign_id ON public.cards USING btree (campaign_id);

CREATE INDEX idx_cards_created ON public.cards USING btree (created);

CREATE INDEX idx_cards_email ON public.cards USING btree (email);

CREATE INDEX idx_cards_status ON public.cards USING btree (status);

CREATE INDEX idx_cards_updated ON public.cards USING btree (updated);

alter table "public"."cards" add constraint "cards_pkey" PRIMARY KEY using index "cards_pkey";

alter table "public"."cards" add constraint "cards_loopy_id_key" UNIQUE using index "cards_loopy_id_key";

grant delete on table "public"."cards" to "anon";

grant insert on table "public"."cards" to "anon";

grant references on table "public"."cards" to "anon";

grant select on table "public"."cards" to "anon";

grant trigger on table "public"."cards" to "anon";

grant truncate on table "public"."cards" to "anon";

grant update on table "public"."cards" to "anon";

grant delete on table "public"."cards" to "authenticated";

grant insert on table "public"."cards" to "authenticated";

grant references on table "public"."cards" to "authenticated";

grant select on table "public"."cards" to "authenticated";

grant trigger on table "public"."cards" to "authenticated";

grant truncate on table "public"."cards" to "authenticated";

grant update on table "public"."cards" to "authenticated";

grant delete on table "public"."cards" to "service_role";

grant insert on table "public"."cards" to "service_role";

grant references on table "public"."cards" to "service_role";

grant select on table "public"."cards" to "service_role";

grant trigger on table "public"."cards" to "service_role";

grant truncate on table "public"."cards" to "service_role";

grant update on table "public"."cards" to "service_role";


