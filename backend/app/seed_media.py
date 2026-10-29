import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.media import MediaPost

logger = logging.getLogger(__name__)

INITIAL_MEDIA_POSTS = [
    {
        "title": "Ratel Plus Expands High-Speed Metro Fiber Across Kano Metropolitan Layouts",
        "slug": "ratel-expands-metro-fiber-kano",
        "category": "Infrastructure & Fiber",
        "summary": "Phase-2 fiber optic backbone expansion connects over 2,500 residential homes and corporate office complexes with unthrottled gigabit speeds.",
        "content": """Ratel Plus Nigeria Limited has officially commissioned Phase 2 of its state-of-the-art Metro Fiber deployment across Kano metropolis.

The infrastructure project, spanning over 65 kilometers of underground high-density fiber optic cable, is designed to deliver symmetric, ultra-low latency internet access to homes, educational institutions, commercial centers, and healthcare providers.

### Gigabit Speeds & Unthrottled Reliability
With GPON and active Ethernet technology, subscribers can experience speeds up to 1Gbps with 99.9% uptime SLA. Unlike traditional wireless links, subterranean optical fiber is immune to weather degradation, radio frequency interference, and signal congestion.

"Our goal is to turn northern Nigeria into a prime digital hub for software development, remote work, enterprise cloud computing, and digital transformation," said Engr. Ahmed Bello, Head of Network Engineering at Ratel Plus.

### Key Deployment Highlights
- 65+ kilometers of newly energized underground ducting
- Redundant core interconnection with the Internet Exchange Point of Nigeria (IXPN)
- 24/7 proactive NOC monitoring and field rapid response units
- Direct peering with major global content delivery networks (CDNs)

Residential and commercial property owners can check coverage and request site survey inspections directly on the Ratel Plus portal.""",
        "featured_image": "/phone_dialer.png",
        "author": "Engr. Ahmed Bello",
        "read_time": "4 min read",
        "tags": ["Fiber", "FTTH", "Kano", "Broadband", "Infrastructure"],
        "is_published": True,
        "views_count": 0,
    },
    {
        "title": "Next-Gen Ratel Phone App Launched with Crystal-Clear HD VoIP Calling",
        "slug": "next-gen-ratel-phone-app-launched",
        "category": "Product Launch",
        "summary": "Our official SIP softphone application is now available on Android Google Play and Apple App Store, featuring crystal-clear audio and zero roaming fees.",
        "content": """Ratel Plus is excited to announce the official release of the **Ratel Phone App** on both Google Play Store and Apple iOS App Store.

The app transforms any smartphone into an enterprise-grade extension, allowing users to make and receive high-definition phone calls over Wi-Fi, 4G, or fiber data connections.

### Why Choose Ratel Phone?
- **HD Voice Quality:** Utilizes high-efficiency Opus and G.722 codecs for crystal clear audio even on congested connections.
- **Cheapest Call Rates:** Call any Nigerian network or international destination at a fraction of standard mobile tariffs.
- **Enterprise Extension Sync:** Remote workers and office staff can answer their desk phones directly from their mobile devices wherever they are in the world.
- **Encrypted Communications:** End-to-end TLS signaling and SRTP media encryption protect your voice calls from eavesdropping and toll fraud.

### How to Get Started
1. Download the app from the Google Play Store or Apple App Store.
2. Complete your NIN verification on the Ratel Plus subscriber portal.
3. Choose your personalized phone number and start making clear calls immediately!""",
        "featured_image": "/phone_dialer.png",
        "author": "Usman Aliyu",
        "read_time": "3 min read",
        "tags": ["VoIP", "Mobile App", "Voice", "SIP", "Software"],
        "is_published": True,
        "views_count": 0,
    },
    {
        "title": "Empowering Northern Businesses with Dedicated 4G LTE Fixed Wireless Access",
        "slug": "empowering-businesses-with-4g-lte",
        "category": "Wireless & LTE",
        "summary": "Commercial enterprises now have access to high-capacity 4G LTE wireless routers with dedicated bandwidth and guaranteed uptime.",
        "content": """Small and medium businesses (SMBs) across Nigeria require stable, reliable connectivity to power point-of-sale systems, cloud accounting software, customer CRM portals, and team collaboration tools.

Ratel Plus has introduced its new enterprise Fixed Wireless Access (FWA) routers powered by licensed 4G LTE spectrum.

### Engineered for Continuous Business Operations
- **Dedicated Business Bandwidth:** No artificial bandwidth throttling or peak-hour slowdowns.
- **Dual-Band Wi-Fi 6 Support:** Connect up to 64 office devices simultaneously with robust beamforming range.
- **Failover Redundancy:** Automatic multi-SIM and Ethernet failover ensures your office remains online during unexpected regional link cuts.

"We recognize that modern commerce doesn't sleep," explained Kabir Sani, Lead NOC Specialist. "Our enterprise LTE packages guarantee business-first priority queuing across our radio base stations."

Contact our enterprise team today to schedule an onsite RF survey for your premises.""",
        "featured_image": "/phone_dialer.png",
        "author": "Kabir Sani",
        "read_time": "4 min read",
        "tags": ["LTE", "Wireless", "Enterprise", "FWA", "Business"],
        "is_published": True,
        "views_count": 0,
    },
    {
        "title": "Ratel Academy Opens Applications for Telecoms & Optical Fiber Engineering",
        "slug": "ratel-academy-opens-applications",
        "category": "Academy & Training",
        "summary": "Join our comprehensive hands-on technical masterclasses covering fiber fusion splicing, service provider IP routing, and wireless infrastructure.",
        "content": """Ratel Plus is proud to officially open applications for the upcoming cohort of **Ratel Academy**.

As Nigeria's telecommunications sector experiences rapid growth, the demand for certified, field-ready technicians and network engineers has never been higher.

### Practical Learning, Not Just Theory
Our state-of-the-art training facilities in Kano provide students with direct access to:
- Industrial core-alignment optical fusion splicers
- Optical Time-Domain Reflectometers (OTDR) and laser power meters
- Enterprise Mikrotik and Cisco carrier routing racks
- Live 4G LTE eNodeB base station simulation labs

### Career Pathways & Top 20% Placement
The top 20% of graduates from each cohort are offered direct internship and junior engineering employment opportunities within Ratel Plus and partner telecom providers.

Applications are now open online through the **Ratel Academy** portal.""",
        "featured_image": "/phone_dialer.png",
        "author": "Dr. Amina Garba",
        "read_time": "3 min read",
        "tags": ["Academy", "Education", "Fiber", "Networking", "Careers"],
        "is_published": True,
        "views_count": 0,
    },
]


async def seed_media():
    """
    Seeds initial media/blog posts into PostgreSQL if the table is empty,
    and ensures views count reflects actual user visits rather than static values.
    """
    async with AsyncSessionLocal() as session:
        try:
            from sqlalchemy import text
            # Reset any static/fabricated view counts from initial seed to 0 so views are 100% real
            await session.execute(text("UPDATE media_posts SET views_count = 0 WHERE views_count IN (342, 518, 275, 689)"))

            stmt = select(MediaPost).limit(1)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                await session.commit()
                logger.info("media_posts_already_seeded", msg="Table not empty, skipping new inserts")
                return

            logger.info("seeding_initial_media_posts", count=len(INITIAL_MEDIA_POSTS))
            for i, p in enumerate(INITIAL_MEDIA_POSTS):
                post = MediaPost(
                    title=p["title"],
                    slug=p["slug"],
                    category=p["category"],
                    summary=p["summary"],
                    content=p["content"],
                    featured_image=p.get("featured_image"),
                    author=p["author"],
                    read_time=p["read_time"],
                    tags=p.get("tags", []),
                    is_published=p["is_published"],
                    views_count=0,
                    published_at=datetime.utcnow() - timedelta(days=(len(INITIAL_MEDIA_POSTS) - i) * 3),
                )
                session.add(post)

            await session.commit()
            logger.info("media_posts_seeded_successfully")
        except Exception as e:
            await session.rollback()
            logger.error("error_seeding_media_posts", error=str(e))
            raise e
