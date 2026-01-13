
/* Small, original JS: handles demo dropdown + active link highlighting */
(function(){
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(a=>{
    if(a.getAttribute("href") === here){
      a.style.opacity = "1";
      a.style.textShadow = "0 10px 18px rgba(40,15,10,.18)";
    }
  });

  const sport = document.getElementById("sportFilter");
  const month = document.getElementById("monthFilter");

  function renderLeader(){
    const key = (sport?.value || "Sport") + "|" + (month?.value || "Kwiecień 2024");
    // deterministic demo data (no external assets)
    const presets = {
      "Sport|Kwiecień 2024":[["Kamil123",45,"👑"],["Ania88",38,"🧑‍🎓"],["Dominik45",34,"🧑‍💻"],["Ewa99",26,"👩‍🎨"],["Marek22",20,"🧑‍🚀"]],
      "Sport|Maj 2024":[["Marek22",52,"👑"],["Kamil123",41,"🧑‍🎓"],["Ewa99",33,"👩‍🎨"],["Ania88",28,"🧑‍💻"],["Dominik45",19,"🧑‍🚀"]],
      "Muzyka|Kwiecień 2024":[["Ania88",49,"👑"],["Ewa99",42,"👩‍🎨"],["Kamil123",31,"🧑‍💻"],["Dominik45",24,"🧑‍🎓"],["Marek22",18,"🧑‍🚀"]],
      "Film|Kwiecień 2024":[["Dominik45",46,"👑"],["Kamil123",37,"🧑‍💻"],["Marek22",29,"🧑‍🚀"],["Ewa99",23,"👩‍🎨"],["Ania88",21,"🧑‍🎓"]],
    };
    const rows = presets[key] || presets["Sport|Kwiecień 2024"];
    const tbody = document.getElementById("leaderBody");
    if(!tbody) return;
    tbody.innerHTML = rows.map((r,i)=>(
      `<tr>
        <td class="rank">${i+1}</td>
        <td>
          <div class="player">
            <div class="avatar" aria-hidden="true">${r[2]}</div>
            <div>${r[0]}</div>
          </div>
        </td>
        <td class="points">${r[1]}</td>
      </tr>`
    )).join("");
  }

  sport?.addEventListener("change", renderLeader);
  month?.addEventListener("change", renderLeader);
  renderLeader();
})();
