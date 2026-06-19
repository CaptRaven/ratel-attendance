from datetime import datetime, timezone, timedelta, time as dt_time

# Nigeria / West Africa Time — no DST.
WAT = timezone(timedelta(hours=1))

# Business days roll over at 06:00 WAT, matching the kiosk/dashboard
# session-rotation boundary (Dashboard.tsx getBusinessDayName / last6AM).
BUSINESS_DAY_ROLLOVER_HOUR = 6

# Night shift (22:00-06:00 WAT) is the only shift that spans the rollover —
# its length equals the rollover hour exactly, so extending the lookback by
# this many hours reaches exactly back to the start of the shift, never
# further into an earlier, genuinely stale record.
NIGHT_SHIFT_HOURS = 8


def get_business_day_start(now: datetime | None = None) -> datetime:
    """
    Start (in UTC) of the current business day, where a business day runs
    06:00 WAT to 05:59:59 WAT the next calendar day.

    Used to bound cross-session checkout lookups so a forgotten checkout
    from a previous business day is never mistaken for an open check-in
    today — once the 6am rollover has passed, a stale record is simply
    left alone (for the admin "Fix Open Records" tool) and a fresh
    check-in is created instead.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    local_now = now.astimezone(WAT)
    business_date = local_now.date()
    if local_now.hour < BUSINESS_DAY_ROLLOVER_HOUR:
        business_date -= timedelta(days=1)
    business_start_local = datetime.combine(
        business_date, dt_time(BUSINESS_DAY_ROLLOVER_HOUR, 0), tzinfo=WAT
    )
    return business_start_local.astimezone(timezone.utc)


def get_night_shift_lookback_start(now: datetime | None = None) -> datetime:
    """
    Earlier cutoff for night-shift cross-session checkout lookups.

    A night-shift check-in at 22:00 WAT must still be findable when the
    employee checks out at, say, 06:30 WAT — even though the standard
    business-day boundary has already rolled over by then. This cutoff
    reaches exactly back to the start of that shift (business day start
    minus 8h = 22:00 WAT the previous evening), no further.
    """
    return get_business_day_start(now) - timedelta(hours=NIGHT_SHIFT_HOURS)
