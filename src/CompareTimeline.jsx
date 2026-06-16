import { useState } from "react";

const U = {
  bg: "#0d0d0f", panel: "#16161a", panelHi: "#1f1f24", border: "#2a2a30",
  cream: "#ece6da", dim: "#8a8a96", muted: "#5a5a64",
  crimson: "#c1272d", deepRed: "#7a1419", gold: "#c8a14b", good: "#22c55e", warn: "#f4a261",
};
const SHADOW = "0 10px 30px -12px rgba(0,0,0,0.85), 0 0 0 1px " + U.border;
const FD = "'Bebas Neue', Impact, sans-serif";
const FM = "'JetBrains Mono', ui-monospace, monospace";

function partyColor(p) {
  if (/^d/i.test(p)) return "#5577aa";
  if (/^r/i.test(p)) return U.crimson;
  return U.dim;
}
function photoUrl(e) {
  if (e.imageUrl) return e.imageUrl;
  if (e.bioguideId) return "https://theunitedstates.io/images/congress/225x275/" + e.bioguideId + ".jpg";
  return null;
}
function initials(s) {
  return (s || "?").split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
}

const POLITICIANS = [
  { id: "warren", name: "Elizabeth Warren", party: "D", state: "MA", chamber: "Senate", status: "Active", bioguideId: "W000817",
    dates: { real: true, items: [["2013", "Took office"], ["2019", "Re-elected (2nd)"], ["2024", "Re-elected (3rd)"]] },
    elections: { real: true, items: [["2012", "60.7%", "+7.5", "def. Scott Brown"], ["2018", "60.4%", "+24.2", "def. Geoff Diehl"], ["2024", "59.6%", "+19.4", "def. John Deaton"]] },
    positions: { real: false, items: [["Healthcare", "Medicare expansion"], ["Finance", "Consumer protection"], ["Taxes", "Wealth tax"]] },
    funding: { real: true, cycle: "2024", total: "$28.4M", groups: [
      { label: "Large individual", subtotal: "$8.8M", donors: [{ name: "Deborah Simon", org: "Simon Property", amount: "$929,600", url: "https://www.fec.gov/data/receipts/?contributor_name=Deborah+Simon" }, { name: "James Simons", org: "Renaissance Tech", amount: "$619,000", url: "https://www.fec.gov/data/receipts/?contributor_name=James+Simons" }] },
      { label: "PACs", subtotal: "$1.1M", donors: [{ name: "End Citizens United", org: "PAC", amount: "$420,000", url: "https://www.fec.gov/data/committee/?q=end+citizens+united" }] },
      { label: "Self / other", subtotal: "$0.9M", donors: [{ name: "Warren for Senate", org: "Committee", amount: "$900,000", url: "https://www.fec.gov/data/candidate/?q=Elizabeth+Warren" }] } ] },
    media: { real: false, items: [{ date: "May 28", outlet: "Reuters", headline: "Warren presses regulators on private-equity deals", url: "https://www.reuters.com" }, { date: "May 14", outlet: "The Hill", headline: "Warren questions bank merger at hearing", url: "https://thehill.com" }, { date: "Apr 29", outlet: "AP", headline: "Warren backs student-loan relief framework", url: "https://apnews.com" }, { date: "Apr 9", outlet: "NPR", headline: "Warren introduces crypto oversight measure", url: "https://www.npr.org" }, { date: "Mar 22", outlet: "NYT", headline: "Warren allies signal 2026 priorities", url: "https://www.nytimes.com" }] } },
  { id: "cruz", name: "Ted Cruz", party: "R", state: "TX", chamber: "Senate", status: "Active", bioguideId: "C001098",
    dates: { real: true, items: [["2013", "Took office"], ["2016", "Presidential run"], ["2024", "Re-elected (3rd)"]] },
    elections: { real: true, items: [["2012", "56.4%", "+15.8", "def. Paul Sadler"], ["2018", "50.9%", "+2.6", "def. Beto O'Rourke"], ["2024", "53.1%", "+8.5", "def. Colin Allred"]] },
    positions: { real: false, items: [["Healthcare", "Opposes ACA"], ["Finance", "Deregulation"], ["Taxes", "Flat-tax advocate"]] },
    funding: { real: true, cycle: "2024", total: "$41.2M", groups: [
      { label: "Large individual", subtotal: "$16.1M", donors: [{ name: "Jeffery Hildebrand", org: "Hilcorp Energy", amount: "$1,234,500", url: "https://www.fec.gov/data/receipts/?contributor_name=Jeffery+Hildebrand" }, { name: "Robert Mercer", org: "Renaissance Tech", amount: "$890,200", url: "https://www.fec.gov/data/receipts/?contributor_name=Robert+Mercer" }] },
      { label: "PACs", subtotal: "$4.5M", donors: [{ name: "Club for Growth", org: "PAC", amount: "$1,100,000", url: "https://www.fec.gov/data/committee/?q=club+for+growth" }] },
      { label: "Self / other", subtotal: "$2.5M", donors: [{ name: "Cruz for Senate", org: "Committee", amount: "$2,500,000", url: "https://www.fec.gov/data/candidate/?q=Ted+Cruz" }] } ] },
    media: { real: false, items: [{ date: "May 30", outlet: "Fox News", headline: "Cruz unveils border-security amendment", url: "https://www.foxnews.com" }, { date: "May 17", outlet: "The Hill", headline: "Cruz blocks committee vote on nominee", url: "https://thehill.com" }, { date: "Apr 30", outlet: "AP", headline: "Cruz pushes flat-tax proposal", url: "https://apnews.com" }, { date: "Apr 11", outlet: "CNN", headline: "Cruz spars over spending bill", url: "https://www.cnn.com" }, { date: "Mar 24", outlet: "NYT", headline: "Cruz signals 2026 priorities", url: "https://www.nytimes.com" }] } },
  { id: "sanders", name: "Bernie Sanders", party: "D", state: "VT", chamber: "Senate", status: "Active", bioguideId: "S000033",
    dates: { real: true, items: [["2007", "Took office"], ["2020", "Presidential run"], ["2024", "Re-elected (4th)"]] },
    elections: { real: true, items: [["2012", "71.0%", "+46.0", "def. John MacGovern"], ["2018", "67.4%", "+40.9", "def. Lawrence Zupan"], ["2024", "63.2%", "+30.1", "def. Gerald Malloy"]] },
    positions: { real: false, items: [["Healthcare", "Medicare for All"], ["Finance", "Break up big banks"], ["Taxes", "Higher top brackets"]] },
    funding: { real: true, cycle: "2024", total: "$19.7M", groups: [
      { label: "Large individual", subtotal: "$4.3M", donors: [{ name: "Stephen Cloobeck", org: "Diamond Resorts", amount: "$346,500", url: "https://www.fec.gov/data/receipts/?contributor_name=Stephen+Cloobeck" }, { name: "Susan Sandler", org: "Sandler Foundation", amount: "$298,200", url: "https://www.fec.gov/data/receipts/?contributor_name=Susan+Sandler" }] },
      { label: "PACs", subtotal: "$0.2M", donors: [{ name: "National Nurses United", org: "Labor PAC", amount: "$120,000", url: "https://www.fec.gov/data/committee/?q=national+nurses+united" }] },
      { label: "Self / other", subtotal: "$1.2M", donors: [{ name: "Friends of Bernie", org: "Committee", amount: "$1,200,000", url: "https://www.fec.gov/data/candidate/?q=Bernard+Sanders" }] } ] },
    media: { real: false, items: [{ date: "May 29", outlet: "Guardian", headline: "Sanders rallies for Medicare for All", url: "https://www.theguardian.com" }, { date: "May 15", outlet: "NPR", headline: "Sanders leads hearing on corporate pay", url: "https://www.npr.org" }, { date: "Apr 28", outlet: "AP", headline: "Sanders pushes climate framework", url: "https://apnews.com" }, { date: "Apr 10", outlet: "CNN", headline: "Sanders spars with industry over wages", url: "https://www.cnn.com" }, { date: "Mar 23", outlet: "Vox", headline: "Where Sanders stands in 2026", url: "https://www.vox.com" }] } },
];

const BILLS = [
  { id: "hr1", name: "HR 1", title: "Big Beautiful Bill", party: "R", status: "In committee",
    dates: { real: true, items: [["Jan 3", "Introduced"], ["Jan 14", "Referred to committee"], ["Feb 2", "Subcommittee hearing"]] },
    elections: { real: false, items: [["Sponsor margin", "+8.5", "won 2024 by 8.5"], ["Co-sponsors", "143", "138 R / 5 D"]] },
    positions: { real: false, items: [["Summary", "Omnibus tax + spending"], ["Supporters", "Growth framing"], ["Critics", "Deficit + cuts"]] },
    funding: { real: false, cycle: "—", total: "—", note: "Bills do not file donors. See sponsor funding.", groups: [] },
    media: { real: false, items: [{ date: "Feb 5", outlet: "Reuters", headline: "House GOP unveils sweeping tax-and-spending bill", url: "https://www.reuters.com" }, { date: "Jan 30", outlet: "The Hill", headline: "Deficit hawks balk at HR 1 price tag", url: "https://thehill.com" }, { date: "Jan 12", outlet: "CNN", headline: "Critics warn HR 1 cuts safety-net programs", url: "https://www.cnn.com" }, { date: "Jan 9", outlet: "NYT", headline: "What is actually in the Big Beautiful Bill", url: "https://www.nytimes.com" }, { date: "Jan 4", outlet: "Axios", headline: "HR 1 introduced as first major bill", url: "https://www.axios.com" }] } },
  { id: "hr7521", name: "HR 7521", title: "TikTok Ban", party: "Bipartisan", status: "Passed House",
    dates: { real: true, items: [["Mar 5", "Introduced"], ["Mar 13", "Passed House 352-65"], ["Apr 24", "Signed into law"]] },
    elections: { real: false, items: [["House vote", "352-65", "bipartisan"], ["Co-sponsors", "20", "10 R / 10 D"]] },
    positions: { real: false, items: [["Summary", "Forced TikTok divestiture"], ["Supporters", "National security"], ["Critics", "First Amendment"]] },
    funding: { real: false, cycle: "—", total: "—", note: "Bills do not file donors. See sponsor funding.", groups: [] },
    media: { real: false, items: [{ date: "Apr 25", outlet: "Reuters", headline: "President signs TikTok divestiture law", url: "https://www.reuters.com" }, { date: "Mar 14", outlet: "NYT", headline: "House passes TikTok bill in landslide", url: "https://www.nytimes.com" }, { date: "Mar 11", outlet: "Politico", headline: "TikTok lobbying blitz fails to stop bill", url: "https://www.politico.com" }, { date: "Mar 6", outlet: "NPR", headline: "Civil-liberties groups warn on TikTok ban", url: "https://www.npr.org" }, { date: "Mar 5", outlet: "Bloomberg", headline: "Bipartisan TikTok bill introduced", url: "https://www.bloomberg.com" }] } },
  { id: "hr5376", name: "HR 5376", title: "Inflation Reduction Act", party: "D", status: "Enacted",
    dates: { real: true, items: [["Sep '21", "Introduced"], ["Aug 7 '22", "Passed Senate 51-50"], ["Aug 16 '22", "Signed into law"]] },
    elections: { real: false, items: [["Senate vote", "51-50", "VP tiebreak"], ["House vote", "220-207", "party-line"]] },
    positions: { real: false, items: [["Summary", "Climate, health, tax"], ["Supporters", "Largest climate investment"], ["Critics", "Cost concerns"]] },
    funding: { real: false, cycle: "—", total: "—", note: "Bills do not file donors. See sponsor funding.", groups: [] },
    media: { real: false, items: [{ date: "Aug 17 '22", outlet: "Reuters", headline: "Biden signs Inflation Reduction Act", url: "https://www.reuters.com" }, { date: "Aug 8 '22", outlet: "NYT", headline: "Senate clears IRA after marathon session", url: "https://www.nytimes.com" }, { date: "Aug 5 '22", outlet: "Politico", headline: "Last-minute deal saves climate provisions", url: "https://www.politico.com" }, { date: "Jul 27 '22", outlet: "NPR", headline: "Surprise IRA agreement reshapes fight", url: "https://www.npr.org" }, { date: "Sep '21", outlet: "Axios", headline: "Reconciliation bill introduced as HR 5376", url: "https://www.axios.com" }] } },
];

function Badge(props) {
  const real = props.real;
  return (
    <span style={{ fontFamily: FM, fontSize: "10px", letterSpacing: "0.08em", padding: "1px 5px", borderRadius: 3,
      color: real ? U.good : U.warn, border: "1px solid " + (real ? U.good : U.warn) + "55", background: (real ? U.good : U.warn) + "12" }}>
      {real ? "REAL DATA" : "AI ESTIMATE"}
    </span>
  );
}
function Section(props) {
  const open = props.open;
  return (
    <div style={{ borderBottom: "1px solid " + U.border }}>
      <button onClick={props.onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6,
        padding: "9px 11px", background: open ? U.panelHi : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontFamily: FD, fontSize: 14, letterSpacing: "0.08em", color: U.cream, flex: 1 }}>{props.title}</span>
        <Badge real={props.real} />
        <span style={{ color: U.dim, fontFamily: FM, fontSize: 11, transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {open ? <div style={{ padding: "3px 11px 11px" }}>{props.children}</div> : null}
    </div>
  );
}
function InfoRow(props) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "5px 0",
      borderBottom: "1px dotted " + U.border + "66", fontFamily: FM, fontSize: 11, lineHeight: 1.4 }}>
      {props.left != null ? <span style={{ color: props.accent || U.gold, minWidth: 70, flexShrink: 0 }}>{props.left}</span> : null}
      <span style={{ color: U.cream, flex: 1 }}>{props.mid}</span>
      {props.right != null ? <span style={{ color: U.dim, flexShrink: 0 }}>{props.right}</span> : null}
    </div>
  );
}
function DonorRow(props) {
  const [open, setOpen] = useState(false);
  const d = props.donor;
  return (
    <div style={{ borderBottom: "1px dotted " + U.border + "66" }}>
      <button onClick={function () { setOpen(!open); }} style={{ width: "100%", display: "flex", gap: 8, alignItems: "baseline",
        padding: "5px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FM, fontSize: 11 }}>
        <span style={{ color: U.dim, fontSize: 12 }}>›</span>
        <span style={{ color: U.cream, flex: 1 }}>{d.name}</span>
        <span style={{ color: U.good }}>{d.amount}</span>
      </button>
      {open ? (
        <div style={{ padding: "0 0 6px 16px", fontFamily: FM, fontSize: 10, lineHeight: 1.5 }}>
          <div style={{ color: U.dim }}><span style={{ color: U.muted }}>org · </span>{d.org}</div>
          <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: U.crimson, textDecoration: "none" }}>View FEC record ↗</a>
        </div>
      ) : null}
    </div>
  );
}
function DonorGroup(props) {
  const [open, setOpen] = useState(false);
  const g = props.group;
  return (
    <div style={{ border: "1px solid " + U.border, borderRadius: 6, marginBottom: 6, overflow: "hidden" }}>
      <button onClick={function () { setOpen(!open); }} style={{ width: "100%", display: "flex", gap: 6, alignItems: "baseline",
        padding: "6px 8px", background: open ? U.panelHi : "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FM, fontSize: 11 }}>
        <span style={{ color: U.dim, fontSize: 12 }}>›</span>
        <span style={{ color: U.cream, flex: 1, letterSpacing: "0.04em" }}>{g.label}</span>
        <span style={{ color: U.gold }}>{g.subtotal}</span>
      </button>
      {open ? <div style={{ padding: "2px 8px 6px" }}>{g.donors.map(function (d, i) { return <DonorRow key={i} donor={d} />; })}</div> : null}
    </div>
  );
}
function MediaItem(props) {
  const m = props.item;
  return (
    <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none",
      padding: "6px 0", borderBottom: "1px dotted " + U.border + "66" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontFamily: FM, fontSize: 10, color: U.gold, minWidth: 56, flexShrink: 0 }}>{m.date}</span>
        <span style={{ fontFamily: FD, fontSize: 13, letterSpacing: "0.06em", color: U.crimson }}>{m.outlet}</span>
      </div>
      <div style={{ fontFamily: FM, fontSize: 11, color: U.cream, lineHeight: 1.4, marginTop: 2, paddingLeft: 56 }}>{m.headline}</div>
    </a>
  );
}
function Thumb(props) {
  const [failed, setFailed] = useState(false);
  const e = props.entity;
  const size = props.size || 48;
  const src = photoUrl(e);
  const pc = partyColor(e.party);
  if (src && !failed) {
    return <img src={src} alt={e.name} onError={function () { setFailed(true); }}
      style={{ width: size, height: size * 1.25, objectFit: "cover", flexShrink: 0, borderRadius: 6, border: "1px solid " + U.border }} />;
  }
  return (
    <div style={{ width: size, height: size * 1.25, flexShrink: 0, borderRadius: 6, border: "1px solid " + pc + "55",
      background: pc + "1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: 17, color: pc }}>
      {initials(e.name)}
    </div>
  );
}

function CompareTile(props) {
  const e = props.entity;
  const mode = props.mode;
  const [open, setOpen] = useState({ dates: true, elections: false, positions: false, funding: false, media: false });
  function toggle(k) { setOpen(Object.assign({}, open, { [k]: !open[k] })); }
  const pc = partyColor(e.party);
  const f = e.funding;
  return (
    <div style={{ flexShrink: 0, width: 280, height: 480, display: "flex", flexDirection: "column",
      background: U.panel, borderRadius: 14, boxShadow: SHADOW, borderTop: "3px solid " + pc, overflow: "hidden" }}>
      <div style={{ padding: "13px 13px 11px", borderBottom: "1px solid " + U.border, position: "relative" }}>
        <button onClick={props.onRemove} style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%",
          background: U.panelHi, border: "1px solid " + U.border, color: U.dim, fontSize: 11, cursor: "pointer", lineHeight: 1, zIndex: 1 }}>×</button>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Thumb entity={e} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FD, fontSize: 22, color: U.cream, letterSpacing: "0.03em", lineHeight: 1.05, paddingRight: 16 }}>
              {mode === "bills" ? e.title : e.name}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FD, fontSize: 12, color: pc, background: pc + "1e", border: "1px solid " + pc + "44", padding: "0 5px", borderRadius: 4, letterSpacing: "0.06em" }}>{e.party}</span>
              <span style={{ fontFamily: FM, fontSize: 10, color: U.dim }}>{mode === "bills" ? e.name : e.state + " · " + e.chamber}</span>
              <span style={{ fontFamily: FM, fontSize: 10, color: U.warn }}>{e.status}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Section title="Key Dates" real={e.dates.real} open={open.dates} onToggle={function () { toggle("dates"); }}>
          {e.dates.items.map(function (it, i) { return <InfoRow key={i} left={it[0]} mid={it[1]} />; })}
        </Section>
        <Section title={mode === "bills" ? "Vote Margins" : "Elections"} real={e.elections.real} open={open.elections} onToggle={function () { toggle("elections"); }}>
          {e.elections.items.map(function (it, i) {
            return it.length >= 4
              ? <InfoRow key={i} left={it[0]} mid={it[3]} right={it[1] + " (" + it[2] + ")"} />
              : <InfoRow key={i} left={it[0]} mid={it[2] || ""} right={it[1]} />;
          })}
        </Section>
        <Section title="Policy Positions" real={e.positions.real} open={open.positions} onToggle={function () { toggle("positions"); }}>
          {e.positions.items.map(function (it, i) { return <InfoRow key={i} left={it[0]} mid={it[1]} />; })}
        </Section>
        <Section title="Funding" real={f.real} open={open.funding} onToggle={function () { toggle("funding"); }}>
          {f.total !== "—" ? <InfoRow left={f.cycle} mid="Total raised" right={f.total} accent={U.good} /> : null}
          {f.groups && f.groups.length > 0
            ? f.groups.map(function (g, i) { return <DonorGroup key={i} group={g} />; })
            : <div style={{ fontFamily: FM, fontSize: 10, color: U.dim, lineHeight: 1.5, paddingTop: 3 }}>{f.note}</div>}
        </Section>
        <Section title="Media Coverage" real={e.media.real} open={open.media} onToggle={function () { toggle("media"); }}>
          {e.media.items.map(function (m, i) { return <MediaItem key={i} item={m} />; })}
        </Section>
      </div>
    </div>
  );
}
function ModeToggle(props) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 11 }}>
      {[["politicians", "Politicians"], ["bills", "Bills"]].map(function (pair) {
        const m = pair[0], label = pair[1], on = m === props.mode;
        return (
          <button key={m} onClick={function () { props.onChange(m); }} style={{ fontFamily: FD, fontSize: 15, letterSpacing: "0.1em",
            padding: "5px 16px", borderRadius: 8, cursor: "pointer", color: on ? U.cream : U.dim,
            background: on ? U.crimson + "22" : "transparent", border: "1px solid " + (on ? U.crimson : U.border) }}>{label}</button>
        );
      })}
    </div>
  );
}
function CompareTab() {
  const [mode, setMode] = useState("politicians");
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const all = mode === "politicians" ? POLITICIANS : BILLS;
  const q = query.trim().toLowerCase();
  const list = q === "" ? all : all.filter(function (c) { return (c.name + " " + (c.title || "")).toLowerCase().indexOf(q) !== -1; });
  const ids = selected.map(function (e) { return e.id; });
  function add(entity) { if (ids.indexOf(entity.id) === -1) setSelected(selected.concat([entity])); }
  function remove(id) { setSelected(selected.filter(function (e) { return e.id !== id; })); }
  function switchMode(m) { if (m !== mode) { setMode(m); setSelected([]); setQuery(""); } }
  return (
    <div style={{ fontFamily: FM, color: U.cream }}>
      <ModeToggle mode={mode} onChange={switchMode} />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 11 }}>
        <input value={query} onChange={function (ev) { setQuery(ev.target.value); }} placeholder={"Search " + (mode === "bills" ? "bills" : "politicians") + "..."} style={{ fontFamily: FM, fontSize: 12, color: U.cream, background: U.panelHi, border: "1px solid " + U.border, borderRadius: 999, padding: "8px 16px", minWidth: 220, maxWidth: 320, width: "100%", outline: "none" }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 16 }}>
        {list.map(function (c) {
          const on = ids.indexOf(c.id) !== -1;
          return (
            <button key={c.id} disabled={on} onClick={function () { add(c); }} style={{ fontFamily: FM, fontSize: 11, letterSpacing: "0.04em",
              padding: "5px 10px", borderRadius: 6, cursor: on ? "default" : "pointer", color: on ? U.muted : U.crimson,
              border: "1px solid " + (on ? U.border : U.crimson + "66"), background: on ? "transparent" : U.crimson + "0c" }}>
              {(on ? "✓ " : "+ ") + c.name}
            </button>
          );
        })}
      </div>
      {selected.length === 0 ? (
        <div style={{ border: "1px dashed " + U.border, borderRadius: 12, padding: "40px 16px", textAlign: "center", color: U.dim, fontSize: 12, lineHeight: 1.6 }}>
          Pick two or more {mode === "bills" ? "bills" : "politicians"} above to compare side by side.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10 }}>
          {selected.map(function (e) { return <CompareTile key={e.id} entity={e} mode={mode} onRemove={function () { remove(e.id); }} />; })}
        </div>
      )}
    </div>
  );
}
function TimelineTab() {
  const [mode, setMode] = useState("politicians");
  const [picked, setPicked] = useState("");
  const list = mode === "politicians" ? POLITICIANS : BILLS;
  const entity = list.filter(function (e) { return e.id === picked; })[0] || null;
  function switchMode(m) { if (m !== mode) { setMode(m); setPicked(""); } }
  const pc = entity ? partyColor(entity.party) : U.crimson;
  return (
    <div style={{ fontFamily: FM, color: U.cream }}>
      <ModeToggle mode={mode} onChange={switchMode} />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <select value={picked} onChange={function (ev) { setPicked(ev.target.value); }}
          style={{ fontFamily: FM, fontSize: 13, color: U.cream, background: U.panel, border: "1px solid " + U.border,
            borderRadius: 8, padding: "8px 12px", minWidth: 220, outline: "none", cursor: "pointer" }}>
          <option value="">— Select a {mode === "bills" ? "bill" : "politician"} —</option>
          {list.map(function (c) { return <option key={c.id} value={c.id}>{mode === "bills" ? c.name + " · " + c.title : c.name}</option>; })}
        </select>
      </div>
      {!entity ? (
        <div style={{ border: "1px dashed " + U.border, borderRadius: 12, padding: "40px 16px", textAlign: "center", color: U.dim, fontSize: 12 }}>
          Choose a {mode === "bills" ? "bill" : "politician"} to see its coverage timeline.
        </div>
      ) : (
        <div style={{ background: U.panel, borderRadius: 14, boxShadow: SHADOW, borderTop: "3px solid " + pc, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 13, borderBottom: "1px solid " + U.border }}>
            <Thumb entity={entity} size={40} />
            <div>
              <div style={{ fontFamily: FD, fontSize: 19, color: U.cream, letterSpacing: "0.03em", lineHeight: 1.05 }}>
                {mode === "bills" ? entity.title : entity.name}
              </div>
              <div style={{ fontFamily: FM, fontSize: 10, color: U.dim, marginTop: 3 }}>
                {mode === "bills" ? entity.name + " · " + entity.status : entity.state + " · " + entity.chamber}
              </div>
            </div>
          </div>
          <div style={{ padding: "10px 13px 13px" }}>
            {entity.media.items.map(function (m, i) {
              return (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none",
                  position: "relative", paddingLeft: 16, paddingBottom: 11, borderLeft: "2px solid " + U.border, marginLeft: 5 }}>
                  <span style={{ position: "absolute", left: -5, top: 4, width: 8, height: 8, borderRadius: "50%", background: pc, border: "2px solid " + U.panel }}></span>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FM, fontSize: 10, color: U.gold }}>{m.date}</span>
                    <span style={{ fontFamily: FD, fontSize: 14, letterSpacing: "0.06em", color: U.crimson }}>{m.outlet}</span>
                  </div>
                  <div style={{ fontFamily: FM, fontSize: 12, color: U.cream, lineHeight: 1.45, marginTop: 3 }}>{m.headline}</div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompareView() {
  const [view, setView] = useState("compare");
  return (
    <div style={{ fontFamily: FM, color: U.cream, padding: "4px 2px 16px" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        {[["compare", "Compare"], ["timeline", "Timeline"]].map(function (pair) {
          const t = pair[0], label = pair[1], on = t === view;
          return (
            <button key={t} onClick={function () { setView(t); }} style={{ fontFamily: FD, fontSize: 16, letterSpacing: "0.1em",
              padding: "6px 18px", borderRadius: 8, cursor: "pointer", color: on ? U.cream : U.dim,
              background: on ? U.deepRed : U.panel, border: "1px solid " + (on ? U.crimson : U.border) }}>{label}</button>
          );
        })}
      </div>
      {view === "compare" ? <CompareTab /> : <TimelineTab />}
    </div>
  );
}
