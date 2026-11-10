export function transportAdmissionFields(d={},esc=String){
 const family=d.transportMode==='family';
 const val=k=>esc(d[k]||'');
 return `<fieldset class="site-panel"><legend>接送入驻</legend><label>入驻类型<select name="transportMode" id="transport-mode"><option value="operator" ${!family?'selected':''}>校车</option><option value="family" ${family?'selected':''}>私家车</option></select></label><p class="muted">同行家长仅限同一接送行程中，自家学生也实际乘车的安排。不接收脱离自家学生行程的单独接送。</p></fieldset>${family?`<fieldset class="site-panel"><legend>同行家长接送资料</legend><div class="two-columns"><label>自家学生阶段<select name="ownChildStage" required>${['幼儿园','小学','初中','高中'].map(s=>`<option ${d.ownChildStage===s?'selected':''}>${s}</option>`).join('')}</select></label><label>自家学生学校或固定接送点<input name="ownChildSchool" required maxlength="100" value="${val('ownChildSchool')}" placeholder="无需填写学生姓名或班级"></label><label>早间接送时间<input name="pickupTime" type="time" required value="${val('pickupTime')}"></label><label>返程接送时间<input name="returnTime" type="time" required value="${val('returnTime')}"></label><label>车牌号码<input name="vehiclePlate" required maxlength="20" value="${val('vehiclePlate')}"></label><label>可提供座位数（不含自家学生）<input name="seatCount" type="number" min="1" max="6" required value="${val('seatCount')}"></label><label>驾龄（年）<input name="driverExperienceYears" type="number" min="3" max="70" required value="${val('driverExperienceYears')}"></label></div><label><input type="checkbox" name="ownChildOnboard" ${d.ownChildOnboard?'checked':''} required> 我确认每次同行接送时，自家学生也在同一车辆、同一行程中实际乘坐</label><label><input type="checkbox" name="routeOverlapConfirmed" ${d.routeOverlapConfirmed?'checked':''} required> 我确认同行学生的接送范围与自家学生行程一致，不单独绕行接送</label><label><input type="checkbox" name="guardianConfirmed" ${d.guardianConfirmed?'checked':''} required> 我是自家学生的监护人，并在每次接送前与同行学生监护人确认安排</label><p class="banner-note">提交后为待审核，不会直接发布线路。车辆、驾驶资格、保险、儿童乘车设施与当地接送要求需逐项核验；自家学生同行的声明不等于完成核验。</p></fieldset>`:''}`;
}
export function collectTransport(form){
 const data=Object.fromEntries(new FormData(form));
 if(data.transportMode==='family'){
  for(const key of ['ownChildOnboard','guardianConfirmed','routeOverlapConfirmed'])data[key]=form.querySelector(`[name="${key}"]`)?.checked===true;
  for(const key of ['seatCount','driverExperienceYears'])data[key]=Number(data[key]);
 }
 return data;
}
