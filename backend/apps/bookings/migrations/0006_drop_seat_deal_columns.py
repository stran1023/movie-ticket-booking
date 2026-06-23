from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0005_remove_booking_promotion"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE booking
              DROP COLUMN IF EXISTS seat_deal_discount_amount,
              DROP COLUMN IF EXISTS seat_promotion_id;
            """,
            reverse_sql="""
            ALTER TABLE booking
              ADD COLUMN IF NOT EXISTS seat_deal_discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS seat_promotion_id bigint NULL;
            """,
        )
    ]

