更新内容

1. 学生首页按身份识别会议类型
- 博士不再显示硕士会议
- 硕士不再显示博士会议
- 方向负责人只显示方向小组会

2. 学生端增加退出登录按钮
- 首页
- 申请页
- 我的信息页

3. 我的信息页真正可编辑
- 编辑 student_status
- 编辑 is_group_leader
- 编辑 leader_scope
- 保存时会 update profiles 表
- 如果失败，通常是 profiles 的 RLS 没有开放 update

运行
- npm.cmd install
- npm.cmd run dev
