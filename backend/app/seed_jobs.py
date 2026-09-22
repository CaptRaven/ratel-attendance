import asyncio
from app.database import AsyncSessionLocal
from app.models.job import JobOpening
from sqlalchemy import select

INITIAL_JOBS = [
    {
        "title": "Senior Fiber Network Engineer",
        "department": "Telecom Engineering",
        "category": "engineering",
        "location": "Kano, Nigeria",
        "type": "Full-time",
        "experience": "4+ Years",
        "description": "Lead the design, deployment, and optimization of FTTH (Fiber-to-the-Home) backbone infrastructure and GPON networks across commercial and residential layouts.",
        "requirements": [
            "Degree in Telecommunications or Electrical Engineering",
            "CCNA/CCNP Service Provider or equivalent certification",
            "Hands-on experience with OTDR testing, fiber splicing, and GPON OLTs",
        ],
        "is_active": True,
    },
    {
        "title": "NOC & Cloud Operations Specialist",
        "department": "NOC & Infrastructure",
        "category": "noc",
        "location": "Kano / Hybrid",
        "type": "Full-time",
        "experience": "2+ Years",
        "description": "Monitor 24/7 core network transit performance, manage BGP routing tables, resolve upstream ISP outages, and optimize bandwidth utilization.",
        "requirements": [
            "B.Sc in Computer Science, IT, or Networking",
            "Strong knowledge of Mikrotik RouterOS, Cisco IOS, and Linux servers",
            "Experience with Zabbix, PRTG, or Nagios network monitoring",
        ],
        "is_active": True,
    },
    {
        "title": "Enterprise Telecom Sales Manager",
        "department": "Sales & Business Dev",
        "category": "sales",
        "location": "Abuja / Kano",
        "type": "Full-time",
        "experience": "3+ Years",
        "description": "Drive corporate B2B acquisition for Ratel Plus leased lines, IP wholesale, and enterprise VoIP solutions across government and commercial clients.",
        "requirements": [
            "Proven track record in ISP or Telecom enterprise sales",
            "Strong network within corporate and government sectors",
            "Excellent presentation, negotiation, and relationship skills",
        ],
        "is_active": True,
    },
    {
        "title": "Customer Experience & Care Executive",
        "department": "Customer Support",
        "category": "support",
        "location": "Kano, Nigeria",
        "type": "Full-time",
        "experience": "1+ Years",
        "description": "Provide tier-1 technical support, resolve subscriber account inquiries, coordinate field technician dispatch, and maintain high CSAT scores.",
        "requirements": [
            "Degree or HND in any relevant field",
            "Strong verbal and written communication in English and Hausa",
            "Customer service orientation and basic networking troubleshooting skills",
        ],
        "is_active": True,
    },
    {
        "title": "RF & LTE Network Optimization Engineer",
        "department": "Wireless Engineering",
        "category": "engineering",
        "location": "Kano, Nigeria",
        "type": "Full-time",
        "experience": "3+ Years",
        "description": "Plan, optimize, and maintain Ratel Plus fixed-wireless LTE base stations and microwave backhaul links to guarantee sub-millisecond latency.",
        "requirements": [
            "Experience with RF propagation tools and spectrum analyzers",
            "Understanding of 4G/LTE RAN architecture and eNodeB configuration",
            "Field operations experience",
        ],
        "is_active": True,
    },
    {
        "title": "Billing Systems & Software Admin",
        "department": "Corporate IT",
        "category": "corporate",
        "location": "Remote / Kano",
        "type": "Full-time",
        "experience": "2+ Years",
        "description": "Manage and integrate custom subscriber billing platforms, Paystack payment gateways, and automated bandwidth provisioning APIs.",
        "requirements": [
            "Proficiency in PHP, Node.js, and SQL database management",
            "Familiarity with RADIUS servers and CRM integrations",
            "Strong problem-solving and security auditing mindset",
        ],
        "is_active": True,
    },
]


async def seed_jobs():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(JobOpening))
        existing = result.scalars().all()
        if not existing:
            print("Seeding initial job openings...")
            for job_data in INITIAL_JOBS:
                job = JobOpening(**job_data)
                session.add(job)
            await session.commit()
            print(f"Successfully seeded {len(INITIAL_JOBS)} job openings.")
        else:
            print(f"Database already contains {len(existing)} job openings.")


if __name__ == "__main__":
    asyncio.run(seed_jobs())
