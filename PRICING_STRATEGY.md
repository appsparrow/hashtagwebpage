# HashtagWebpage Pricing Strategy & Operations Plan

**Date**: February 28, 2026
**Version**: 1.0
**Focus**: Humanless, high-volume local business website builder

---

## Section 1: The MRR Debate ($299 One-Time vs $199+$9/mo)

### Revenue Comparison at Scale

Assume baseline: 100 previews/month, 15-20% conversion rate = 15-20 sales/month

| Metric | $299 One-Time | $199 Setup + $9/mo |
|--------|---------------|-------------------|
| **Year 1 Revenue (15 sales/mo)** | $53,820 | $36,630 + $1,620 = $38,250 |
| **Year 1 Revenue (20 sales/mo)** | $71,760 | $47,760 + $2,160 = $49,920 |
| **Year 2+ Revenue (15 sales/mo)** | $53,820 | $1,620/mo + new setup fees |
| **Year 3 at 30% customer retention** | $53,820 | $6,480 recurring + $28,320 new = $34,800 |

**Operational Cost Analysis ($9/mo Model at Scale)**

- **Cloudflare Pages hosting**: Zero marginal cost per site (unlimited sites on free tier)
- **Domain management**: ~$10/domain/year (wholesale cost from registrar), managed via Cloudflare API
- **SSL certificates**: Free via Cloudflare (built-in)
- **DNS management**: Cloudflare API handles transfers automatically
- **Email for support**: negligible (automated reminders, template responses)
- **Payment processing**: 2.9% + $0.30 on $9 transactions = ~$0.57/transaction
- **Database/CRM cost**: ~$50-100/month (Airtable or Supabase) for tracking 500 customers
- **Per-customer annual cost**: ~$10 domain + $1.50 payment fees + $1.20 CRM allocation = **~$12.70/customer/year**

**Margin Analysis**

| Model | Revenue/customer/year | Operational Cost/customer | Net Margin |
|-------|----------------------|--------------------------|-----------|
| $299 one-time | $299 | ~$5 (payment fee + API) | **$294 (98%)** |
| $199+$9/mo | $199 + $108 = $307/year 1 | ~$12.70 | **$294 (96%)** |

**Critical Finding**: Margins are nearly identical, but model choice depends on *other factors*.

### Scaling to 500+ Customers: Which Model?

**$299 One-Time Model**
- ✅ Zero recurring operational burden
- ✅ Customers self-host (you provide guides)
- ✅ Scales linearly with sales, no retention pressure
- ❌ Zero recurring revenue = lumpy cash flow
- ❌ No repeat touchpoints = high churn in customer relationships

**$199 Setup + $9/mo Model**
- ✅ Recurring revenue = predictable cash flow ($45/mo per 5 customers)
- ✅ 500 customers = $4,500/mo baseline (even with 0 new sales)
- ✅ Repeat billing touchpoints = upsell opportunities
- ✅ Domain/hosting ownership = customer lock-in (mild, ethical)
- ❌ CF Pages scaling: at 500 sites, CF account becomes complex to manage (DNS, domain tracking)
- ❌ Churn kills the model fast (lose $9/mo per customer + setup fee amortization)

### Churn Risk on $9/mo

**Real talk**: Local business owners on $9/mo hosting will churn when:
1. They outgrow free tier (site traffic spikes) → they'll want to move to Shopify/WooCommerce
2. They hire a "real" web designer → churn is immediate
3. They get bored or forget they're paying → lose 5-10% annually

**Payback period on $199 setup fee**: 22 months of $9 payments.
If churn > 5% annually, the model doesn't work profitably.

### Recommendation

**Choose the $299 one-time model with optional $9/mo upsell.**

**Reasoning:**
1. **Simplicity at scale**: No recurring account management. No domain transfers to manage. You're a website generator, not a hosting company.
2. **Margin preservation**: Nearly identical margins, but zero operational complexity.
3. **Humanless delivery**: Guides + automation handle everything. No support tickets for "my $9/mo bill went up" or DNS issues.
4. **Offer $9/mo as white-label add-on** (not a default): For customers who want *you* to manage hosting/domain, charge it, but make it optional. This gives recurring revenue without betting the company on churn.
5. **Position correctly**: "$299 to own your site forever" beats "$199 + $9/mo lock-in" for local business owners. Simpler sell.

**Default**: Sell $299, include domain/hosting setup guide.
**Upsell**: "Want us to manage your domain and hosting for you? $9/mo includes updates & SSL."

---

## Section 2: The CF Pages Hosting Model

### Owner's Proposal
"Add client sites as CF Pages projects under the hashtagwebpage CF account + manage custom domains."

### Technical Reality Check

| Factor | Assessment | Scale Viability |
|--------|-----------|-----------------|
| **CF Pages free tier** | Unlimited sites, unlimited bandwidth, unlimited functions | ✅ YES at 500+ sites |
| **Custom domain setup** | Add via Cloudflare dashboard (1 API call per domain) | ✅ Automatable |
| **DNS management** | Cloudflare becomes nameserver for client domain | ✅ Scripted via API |
| **SSL auto-renewal** | Built-in, free | ✅ NO manual work |
| **Site isolation** | Each site in separate CF Pages project | ⚠️ Management overhead |
| **Customer domain transfer** | Customer points domain elsewhere (you no longer manage) | ⚠️ Possible, needs process |

### Domain Management at Scale

**Adding a custom domain to a CF Pages site:**
1. Customer buys domain (via registrar or you buy wholesale and resell)
2. You add domain to CF Pages project (1 API call)
3. You point domain's nameservers to Cloudflare (automatic)
4. SSL certificate issues in ~5 minutes (automatic)

**Process for 500 customers:**
- Fully automated via Cloudflare API
- Each customer on-boarding: domain registered in Cloudflare's reseller account, added to their site, instant deployment
- No manual DNS editing required

**Real cost**: ~$0.02/domain in API calls + $10/domain/year wholesale registration

### The Transfer Process

**When a customer wants to leave:**
1. You generate API request to "disconnect" domain from CF account
2. Customer updates nameservers at their registrar to point elsewhere (they own domain)
3. Process takes ~10 minutes, fully self-service via email instructions

**Problem**: You don't *own* the domain (they do). You're just managing it.
**Solution**: Include step-by-step "how to move your domain" guide in $199/mo package.

### DNS & Domain Complexity at 500 Sites

**Cloudflare dashboard view with 500 domains**: Cluttered, hard to track.

**Better approach:**
- Store site metadata in database (site slug, domain, customer email, creation date, renewal date)
- Use Cloudflare API to sync state, don't manage manually
- Automated alerts: domain expiration reminders 30 days out

**Verdict**: Viable, but requires a *basic* customer management system (Airtable, Supabase) to track domains/renewal dates. Not truly "humanless" without this automation.

### Viable at 500+ Customers?

**Yes, but with conditions:**
- ✅ CF Pages infrastructure: unlimited sites, no scaling costs
- ✅ Custom domains: fully automatable via API
- ✅ SSL: automatic, free
- ⚠️ **BUT**: You need a basic CRM/database to track 500 customers' domains, renewal dates, and transfer status
- ⚠️ **AND**: You need to build (or buy) a simple "manage my domain/hosting" dashboard so customers can see their status
- ⚠️ **High risk**: If you don't automate domain renewal reminders, you'll get sued for "losing" someone's domain

### Recommendation

**For the $299 model (no recurring hosting):**
- Don't manage domains at all. Provide a PDF guide: "How to buy a domain and point it to your site."
- Truly humanless.

**For the $199/mo model (optional, premium tier):**
- YES, manage domains on CF Pages, but require a domain-tracking database
- Automate renewal reminders 30 days out (email notification)
- Provide a simple status page where customers can see domain/SSL status
- This adds credibility and justifies $9/mo

---

## Section 3: What's Included in Each Package

### Package Definitions

#### **Tier 1: $299 "Full Owner" (Default)**

What they get:
- ✅ Professional website (hero, about, services, contact, testimonials, 5-7 sections)
- ✅ 3 AI-generated custom images (lifestyle/branded photos)
- ✅ Domain setup guide (PDF: how to buy domain, point it at your site)
- ✅ Hosting setup guide (PDF: 5-minute intro to Cloudflare Pages, Netlify, Vercel)
- ✅ Full source code (HTML/CSS/JS) in ZIP file
- ✅ 30-day email support (questions about setup)
- ✅ Google Search Console setup guide (1-page)
- ❌ NOT included: hosting, domain, ongoing updates, SSL management

**Operational cost**: ~$5 per sale (payment processing, email support template responses)
**Humanless delivery**: Fully automated. Email support is template-based (5-10 responses cover 90% of questions).

---

#### **Tier 2: $199 Setup + $9/mo "Managed" (Optional Upsell)**

What they get:
- ✅ Everything in $299 tier
- ✅ We host on Cloudflare Pages (under hashtagwebpage.com/[slug])
- ✅ Custom domain connected & managed (SSL auto-renewal)
- ✅ 1 minor content update per month (text changes, image swap)
- ✅ Domain renewal reminders (30 days out)
- ✅ Easy domain transfer guide (when they want to leave)
- ❌ NOT included: major redesigns, custom features, analytics

**Operational cost**: ~$12.70/customer/year (domain renewal, CRM, payment fees, minimal support)
**Humanless delivery**: Mostly automated, except 1 monthly content update (15 min/month per 50 customers = templated process).

---

### Humanless Operations Definition

| Tier | What Humanless Means | Reality Check |
|------|---------------------|--------------|
| $299 | Leads sourced via API, previews generated automatically, PDF guides sent, payment + file delivery auto-triggered | Actual: 1 person spends 5 min/day monitoring alerts + 2 hrs/week on support email |
| $199/mo | + Domains auto-registered, CF Pages auto-deployed, renewal reminders auto-sent, support = template responses + simple dashboard | Actual: 1 person spends 1 hr/day on CRM updates + domain alerts + 2 hrs/week processing transfers |

**Truth**: "Humanless" means 95% automation. You still need 1 person part-time ($2-3k/month) at 100+ customers to monitor alerts and handle edge cases.

---

## Section 4: Homepage FAQ (10 Q&As)

### FAQ: Is it Really Free to Preview?

**Q: Is it really free? What's the catch?**

A: Yes, the preview site is completely free. No credit card required. The catch is that we're testing if you love the design—if you do, you pay $299 to own it. If you don't, we delete it and you owe nothing. We make money when you're happy, not before.

---

### FAQ: Timeline

**Q: How long does it take to get my preview site?**

A: 2–3 days max. We pull your business info from Google, generate a few custom images with AI, and build your site. You'll get an email with a link to review it. If it takes longer, we'll email you with a timeline update.

---

### FAQ: Changes & Customization

**Q: Can I ask for changes or request something different?**

A: If you don't like the design, we'll delete it and you walk away free. If you buy it ($299), you get 30 days of email support to ask questions about setup. Major redesigns or custom features aren't included—but once you own the code, you can hire anyone to modify it.

---

### FAQ: Rejection Process

**Q: What if I don't like the preview?**

A: Tell us why (template, colors, whatever). We delete the site immediately, no charge. We may reach out again in 90 days with a new approach, but zero obligation.

---

### FAQ: Domain Requirements

**Q: Do I need to buy a domain myself, or does this include one?**

A: The $299 package does NOT include a domain. We'll give you a step-by-step PDF guide to buy one ($12/year from any registrar) and point it at your site (15 minutes). Optional: pay $9/month and we handle the domain for you.

---

### FAQ: $299 Value

**Q: What am I paying $299 for if I generate my own site?**

A: You're paying for the custom AI images, professional layout tuned for your business type, Google-optimized code, and the setup guides that make it live in 30 minutes. You get full source code so you own it forever—move it anywhere, modify it, sell the business with it included.

---

### FAQ: Google/SEO

**Q: Will this show up on Google?**

A: Yes. We set up the structure for Google to find it (schema markup, sitemap, meta tags). You'll need to create a free Google Business Profile and submit your site URL, which takes 5 minutes. Ranking depends on your location and competition, like any website.

---

### FAQ: Mobile Responsiveness

**Q: Is it mobile friendly?**

A: Yes. The site looks great on phones, tablets, and desktops. We test all previews on mobile before we send them.

---

### FAQ: Post-Purchase

**Q: What happens after I pay the $299?**

A: You get a ZIP file with your complete site code, domain setup guide, and hosting instructions (Cloudflare, Netlify, Vercel—your pick). We'll answer setup questions via email for 30 days. After that, the site is 100% yours—host it, modify it, or move it anytime.

---

### FAQ: Renewal/Monthly Fee

**Q: Do I have to pay every month after the first payment?**

A: No. $299 is a one-time purchase. If you want us to handle hosting and domain renewal for you (instead of DIY), that's $9/month optional. Most owners pick the $299 option, own the domain, and host it themselves.

---

## Section 5: The "Not Interested" Exit Flow

### Decision Tree: How to Handle Rejections

When a prospect reviews a preview and doesn't convert, they'll likely indicate a reason. Here's how to operationalize each:

```
Customer submits feedback:
├─ "Not interested" (no specific reason)
│  └─ [CRM tag: "rejected_no_reason", set follow-up to 90 days]
├─ "Competitor" (they went with someone else)
│  └─ [CRM tag: "competitor_selected", archive prospect, do not recontact]
├─ "Don't need a website" (offline only, satisfied with current)
│  └─ [CRM tag: "no_need", archive prospect, do not recontact]
├─ "Design doesn't fit my brand"
│  └─ [CRM tag: "design_rejected", set follow-up to 60 days]
└─ "Cost is too high"
   └─ [CRM tag: "price_objection", set follow-up to 180 days]
```

### CRM Workflow

| Outcome | Immediate Action | Follow-up Timing | Next Step |
|---------|------------------|------------------|-----------|
| "Not interested" (generic) | Delete preview site (24-hr delay with email: "Your preview will delete in 24h unless you confirm keep it") | 90 days auto-re-contact | Send new preview with different template |
| "Competitor selected" | Delete preview site (immediate) | Never | Archive in CRM, never contact again |
| "No need website" | Delete preview site (immediate) | Never | Archive in CRM, never contact again |
| "Wrong design" | Delete preview site (immediate) | 60 days | Send new preview with completely different template |
| "Price too high" | Delete preview site (immediate) | 180 days | Re-contact with $199/mo upsell option |

### Site Deletion: Timing & UX

**Current behavior**: Immediate deletion.
**Better approach**: 24-hour delay with email confirmation.

**Email (sent when prospect marks "not interested"):**

> Subject: We're deleting your preview site in 24 hours
>
> Hi [Name],
>
> We understand you're not ready for a website right now. We're deleting your preview site to clean up (and protect your privacy).
>
> **If you change your mind in the next 24 hours**, reply to this email and we'll keep it live.
>
> Otherwise, it disappears tomorrow at this time. No hard feelings—reach out in 90 days if things change.
>
> —HashtagWebpage

**Why 24-hour delay?**
- Prospect gets a "last chance" feeling (psychological hook)
- Catches mistakes (accidental rejections)
- Gives you a final touchpoint before losing the lead

### Re-contact Automation (90-Day Rule)

In your CRM/email automation:

```
IF tag = "rejected_no_reason"
   AND created_date < today - 90 days
   THEN send email:
      "Hey [Name], it's been 3 months. Ready for a website now?"
      [Generate new preview with different template]
```

**Why 90 days?**
- Local business owners often think about websites seasonally
- Q1 = tax planning, Q4 = holiday season planning
- 90 days = long enough to feel like a fresh start

---

## Section 6: Scale Economics

### Baseline Assumptions

- **Previews generated/month**: 100
- **Conversion rate**: 15-20% (industry: 10-15% for digital products)
- **Sales/month**: 15-20
- **Cost per Google Places lead**: ~$0.01 per business found
- **Operational model**: $299 one-time default

### Unit Economics at 100 Previews/Month

| Metric | Value | Notes |
|--------|-------|-------|
| **Previews generated** | 100 | Via Google Places API scraping |
| **Cost per preview** | ~$0.50 | 50x Google API calls @ $0.01 each |
| **Conversion rate** | 17.5% (midpoint) | 15-20% expected range |
| **Sales per month** | 17-18 | 100 × 17.5% |
| **Revenue per month** | $5,085–$5,400 | 17-18 × $299 |
| **Cost per sale** | $28.57 | $50 lead cost ÷ 17.5% conversion |

---

### Year-by-Year Revenue Projection

#### **Year 1: Ramping Up (100 previews/month average)**

| Month | Previews | Conversions | Revenue | Cumulative |
|-------|----------|-------------|---------|-----------|
| Jan–Mar | 50 | 8 | $2,392 | $2,392 |
| Apr–Jun | 75 | 13 | $3,887 | $6,279 |
| Jul–Sep | 100 | 18 | $5,382 | $11,661 |
| Oct–Dec | 100 | 18 | $5,382 | **$17,043** |

**Year 1 Total**: ~$17,000 (assuming ramp-up from 0 in January)

---

#### **Year 2: Stable at 100 previews/month**

| Period | Monthly Revenue | Annual |
|--------|-----------------|--------|
| 100 previews/mo @ 17.5% | $5,235 | **$62,820** |
| Operational cost | -$2,500 | -$30,000 |
| **Net Profit** | **$2,735/mo** | **$32,820** |

---

#### **Year 3: Scale to 200 previews/month**

| Period | Monthly Revenue | Annual |
|--------|-----------------|--------|
| 200 previews/mo @ 17.5% | $10,470 | **$125,640** |
| Operational cost | -$3,500 | -$42,000 |
| **Net Profit** | **$6,970/mo** | **$83,640** |

---

### Cost Breakdown (Annual at 100 Previews/Month)

| Cost Category | Annual Cost | Notes |
|---------------|------------|-------|
| **Google Places API** | $600 | 100 previews × 12 months × 50 calls × $0.01 |
| **Image generation (AI)** | $1,200 | 100 sites/mo × 3 images × $0.10/image via Midjourney API |
| **Email service** (Sendgrid) | $300 | ~10k emails/year at transactional rates |
| **Domain names** (optional add-on) | ~$400 | 40 domains × $10/year (if offering $199/mo tier) |
| **Payment processing** (Stripe) | $1,500 | 2.9% + $0.30 on $5,235/mo revenue |
| **Customer management** (Airtable) | $480 | Airtable Team plan for lead tracking |
| **Server/hosting** | $0 | Cloudflare Pages + GitHub free tier |
| **Personnel (1 person part-time)** | $24,000 | ~10 hrs/week monitoring + support @ $25/hr |
| **Total Annual Cost** | **~$28,480** |

---

### Net Margin Estimate

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|---------|
| **Revenue** | $17,043 | $62,820 | $125,640 |
| **OpEx** | $28,480 | $28,480 | $42,000 |
| **Net Profit** | **-$11,437** | **$34,340** | **$83,640** |
| **Margin %** | -67% | 55% | 67% |

---

### Break-Even Analysis

**At what sales volume do you break even?**

- Monthly OpEx: ~$2,373
- Revenue per sale: $299
- Break-even: ~8 sales/month = ~47 previews/month (at 17.5% conversion)

**Timeline to profitability**: 3-4 months if you can maintain 100+ previews/month.

---

### Sensitivity: What If Conversion Drops to 10%?

| Metric | 17.5% Conv | 10% Conv | Impact |
|--------|-----------|----------|--------|
| Monthly sales | 17.5 | 10 | -43% |
| Monthly revenue | $5,235 | $2,990 | -43% |
| Break-even previews | 47 | 79 | **Need 2x more previews** |
| Break-even sales | 8/mo | 13/mo | **Nearly impossible** |

**Conclusion**: Conversion rate is *critical*. Even small differences (17.5% vs 10%) determine success.

---

### Sensitivity: What If You Scale to 300 Previews/Month?

| Metric | 100/mo | 300/mo |
|--------|--------|--------|
| Monthly sales | 17.5 | 52.5 |
| Monthly revenue | $5,235 | $15,705 |
| Annual revenue | $62,820 | $188,460 |
| Annual OpEx | $28,480 | $36,000 (1 person FT + tools) |
| Annual profit | $34,340 | **$152,460** |
| **Margin %** | 55% | **81%** |

**At 300 previews/month**: You're profitable enough to hire a second person or invest in automation.

---

## Summary Table: Key Metrics at Scale

| Scenario | Previews/mo | Sales/mo | Annual Revenue | Annual Profit | Margin |
|----------|------------|----------|----------------|---------------|--------|
| Conservative (100 @ 15%) | 100 | 15 | $53,820 | $25,340 | 47% |
| Base case (100 @ 17.5%) | 100 | 17.5 | $62,820 | $34,340 | 55% |
| Growth case (200 @ 17.5%) | 200 | 35 | $125,640 | $83,640 | 67% |
| Scale case (300 @ 17.5%) | 300 | 52.5 | $188,460 | $152,460 | 81% |

---

## Final Recommendations

1. **Pricing**: Default to $299 one-time, offer $9/mo as optional upsell. Simple, scalable, high margin.

2. **Hosting**: Don't manage domains unless you build CRM infrastructure. Provide PDF guides for self-hosting.

3. **Humanless Reality**: Expect to hire 1 part-time person ($2-3k/month) by month 3-4 to handle edge cases, rejects, and transfers.

4. **Break-even**: Aim for 50+ previews/month by month 3. At 100+ previews/month, you're profitable.

5. **Conversion Rate**: Track obsessively. 17.5% is good; 10% kills the model. A/B test preview templates.

6. **Customer Lifetime Value**: $299 is fine now. But if you build a $9/mo customer base with 70%+ retention, you unlock VCs and growth funding.

---

**Document Owner**: HashtagWebpage Strategy
**Last Updated**: February 28, 2026
