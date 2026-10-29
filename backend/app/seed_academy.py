import asyncio
from app.database import AsyncSessionLocal
from app.models.academy import AcademyCourse
from sqlalchemy import select

INITIAL_COURSES = [
    {
        "title": "Fiber Optic Fusion Splicing & FTTH Engineering",
        "code": "RATEL-FBE-101",
        "category": "fiber",
        "description": "Comprehensive practical masterclass covering fiber optic principles, color coding, OTDR trace analysis, power meters, fusion splicing machines, and live GPON / FTTH distribution deployment.",
        "syllabus": [
            "Introduction to Optical Physics, Fiber Modes & Cable Geometry",
            "Color Coding, Loose Tube & Ribbon Fiber Preparation",
            "Precision Splicing with Core-Alignment Fusion Splicers",
            "OTDR Testing, Event Analysis & Attenuation Troubleshooting",
            "FTTH Splitters, Distribution Boxes (FDB/FAT) & Drop Cable Installation",
            "Field Safety Standards & ISP Quality Certification",
        ],
        "prerequisites": [
            "Basic technical or electrical foundation",
            "Enthusiasm for physical telecommunications infrastructure",
        ],
        "instructor": "Engr. Ahmed Bello (Senior Field & FTTH Lead)",
        "location": "Ratel Tech Hub, Kano Campus",
        "format": "Onsite",
        "duration": "6 Weeks",
        "schedule": "Mon, Wed & Fri (10:00 AM - 1:00 PM)",
        "fee": "₦45,000",
        "status": "ongoing",
        "start_date": "Oct 14, 2026",
        "end_date": "Nov 25, 2026",
        "capacity": 25,
        "enrolled_count": 18,
        "is_active": True,
    },
    {
        "title": "Enterprise IP Routing, Mikrotik & BGP Core Networks",
        "code": "RATEL-NET-201",
        "category": "networking",
        "description": "Deep dive into service provider IP routing, Mikrotik RouterOS administration, VLAN segmentation, OSPF, and BGP peering with Internet Exchange Points (IXPN) and upstream transit providers.",
        "syllabus": [
            "IPv4/IPv6 Subnetting & Network Design Principles",
            "Mikrotik RouterOS Architecture, CLI & Firewall Configuration",
            "VLANs, Bridge Filtering & QinQ Tagging in ISP Access Networks",
            "Interior Gateway Protocols: OSPF Multi-Area Deployments",
            "Border Gateway Protocol (BGP) Multi-Homing & AS Path Filtering",
            "Bandwidth Queues, Traffic Shaping & QoS for Voice/Data",
        ],
        "prerequisites": [
            "Fundamental networking knowledge (TCP/IP, OSI model)",
            "Personal laptop for laboratory simulation",
        ],
        "instructor": "Kabir Sani (Lead NOC & Routing Specialist)",
        "location": "Ratel NOC Lab / Hybrid",
        "format": "Hybrid",
        "duration": "8 Weeks",
        "schedule": "Tuesdays & Thursdays (4:00 PM - 7:00 PM) + Sat Lab",
        "fee": "₦65,000",
        "status": "registration_open",
        "start_date": "Nov 18, 2026",
        "end_date": "Jan 15, 2027",
        "capacity": 30,
        "enrolled_count": 12,
        "is_active": True,
    },
    {
        "title": "Fixed Wireless Access (FWA) & 4G/LTE Radio Operations",
        "code": "RATEL-WRL-102",
        "category": "wireless",
        "description": "Master RF transmission, line-of-sight path profiling, microwave point-to-point backhaul links, and 4G LTE eNodeB base station alignment and interference mitigation.",
        "syllabus": [
            "Radio Frequency Fundamentals: Decibels, Antennas & Fresnel Zones",
            "Microwave Link Budgeting & Path Loss Calculations",
            "Point-to-Multipoint (PtMP) Base Station Alignment & Sectoring",
            "Spectrum Analysis & RF Noise Floor Management",
            "LTE CPE Installation, Signal Optimization (RSRP, RSRQ, SINR)",
            "Tower Climbing Safety & Mast Earthing/Surge Protection",
        ],
        "prerequisites": [
            "Basic understanding of wireless concepts",
            "Physical capability for outdoor field practice",
        ],
        "instructor": "Engr. Fatima Garba (RF & Spectrum Lead)",
        "location": "Ratel Wireless Engineering Center, Kano",
        "format": "Onsite",
        "duration": "4 Weeks (Intensive)",
        "schedule": "Saturdays (9:00 AM - 4:00 PM)",
        "fee": "₦40,000",
        "status": "upcoming",
        "start_date": "Dec 05, 2026",
        "end_date": "Jan 09, 2027",
        "capacity": 20,
        "enrolled_count": 5,
        "is_active": True,
    },
    {
        "title": "VoIP Telephony, SIP Trunking & Cloud PBX Solutions",
        "code": "RATEL-VOP-301",
        "category": "telecoms",
        "description": "Build carrier-grade voice systems. Learn Session Initiation Protocol (SIP), Asterisk/FreePBX deployment, codec negotiation, DID routing, and softphone provisioning.",
        "syllabus": [
            "VoIP Fundamentals & SIP Signaling Call Flows",
            "Asterisk PBX Setup & Extension Configuration",
            "SIP Trunking, DID Routing & Dial Plan Logic",
            "Voice Codecs (G.711, G.729, Opus) & Jitter Buffer Optimization",
            "Ratel Softphone Mobile App Provisioning & WebRTC",
            "VoIP Security, Toll Fraud Prevention & Fail2ban",
        ],
        "prerequisites": [
            "Linux terminal basics",
            "General networking comprehension",
        ],
        "instructor": "Usman Aliyu (Voice Core Systems Architect)",
        "location": "Virtual Classrooms (Online) + Lab Session",
        "format": "Online",
        "duration": "5 Weeks",
        "schedule": "Weekdays Evening (6:30 PM - 8:30 PM)",
        "fee": "₦50,000",
        "status": "ongoing",
        "start_date": "Oct 20, 2026",
        "end_date": "Nov 28, 2026",
        "capacity": 35,
        "enrolled_count": 27,
        "is_active": True,
    },
    {
        "title": "Linux Server Administration & 24/7 NOC Monitoring",
        "code": "RATEL-SYS-202",
        "category": "software",
        "description": "Acquire practical skills required in telecom Network Operations Centers. Covers Ubuntu/Debian server hardening, DNS/DHCP, Prometheus, Grafana, and automated alerting.",
        "syllabus": [
            "Linux Shell Navigation, Permissions & Systemd Services",
            "BIND9 DNS & ISC-DHCP Server Deployment",
            "Network Monitoring with SNMP, Zabbix & Prometheus",
            "Building Real-Time Grafana Dashboards for ISP Traffic",
            "Incident Escalation Procedures & SLA Management",
            "Bash Scripting for Automated Backups and Healthchecks",
        ],
        "prerequisites": [
            "Computer literacy",
            "Willingness to learn command-line tools",
        ],
        "instructor": "Ibrahim Mukhtar (Lead Infrastructure Engineer)",
        "location": "Ratel Tech Hub, Kano Campus",
        "format": "Hybrid",
        "duration": "6 Weeks",
        "schedule": "Mon & Wed (2:00 PM - 5:00 PM)",
        "fee": "₦55,000",
        "status": "upcoming",
        "start_date": "Dec 01, 2026",
        "end_date": "Jan 18, 2027",
        "capacity": 25,
        "enrolled_count": 8,
        "is_active": True,
    },
]


async def seed_academy():
    async with AsyncSessionLocal() as db:
        print("Checking existing courses in academy_courses...")
        result = await db.execute(select(AcademyCourse))
        existing = result.scalars().all()
        if existing:
            print(f"Academy courses already populated ({len(existing)} found). Skipping.")
            return

        print("Seeding initial academy courses...")
        for c_data in INITIAL_COURSES:
            course = AcademyCourse(**c_data)
            db.add(course)

        await db.commit()
        print(f"Successfully seeded {len(INITIAL_COURSES)} Academy courses!")


seed = seed_academy

if __name__ == "__main__":
    asyncio.run(seed_academy())

