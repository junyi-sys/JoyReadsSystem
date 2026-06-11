# Code Review Finding Template

在记录代码审查中发现的每个问题时使用此模板。

---

## Issue: [标题]

### Severity
- [ ] Critical（阻止部署）
- [ ] High（合并前应修复）
- [ ] Medium（应尽快修复）
- [ ] Low（有则更好）

### Category
- [ ] Security
- [ ] Performance
- [ ] Code Quality
- [ ] Maintainability
- [ ] Testing
- [ ] Design Pattern
- [ ] Documentation

### Location
**文件：** `src/components/UserCard.tsx`

**行号：** 45-52

**函数/方法：** `renderUserDetails()`

### Issue Description

**是什么：** 描述问题是什么。

**为什么重要：** 解释影响以及为什么需要修复。

**当前行为：** 展示有问题的代码或行为。

**预期行为：** 描述应该发生的事情。

### Code Example

#### 当前（有问题）

```typescript
// 展示 N+1 查询问题
const users = fetchUsers();
users.forEach(user => {
  const posts = fetchUserPosts(user.id); // 每个用户一次查询！
  renderUserPosts(posts);
});
```

#### 建议修复

```typescript
// 通过 JOIN 查询优化
const usersWithPosts = fetchUsersWithPosts();
usersWithPosts.forEach(({ user, posts }) => {
  renderUserPosts(posts);
});
```

### Impact Analysis

| 方面 | 影响 | 严重程度 |
|--------|--------|----------|
| Performance | 20 个用户产生 100+ 次查询 | High |
| User Experience | 页面加载缓慢 | High |
| Scalability | 规模扩大时崩溃 | Critical |
| Maintainability | 难以调试 | Medium |

### Related Issues

- `AdminUserList.tsx` 第 120 行有类似问题
- 相关 PR：#456
- 相关 issue：#789

### Additional Resources

- [N+1 Query Problem](https://en.wikipedia.org/wiki/N%2B1_problem)
- [Database Join Documentation](https://docs.example.com/joins)

### Reviewer Notes

- 这是此代码库中的常见模式
- 考虑将其添加到代码风格指南
- 可能值得创建一个辅助函数

### Author Response (for feedback)

*由代码作者填写：*

- [ ] 修复已在提交 `abc123` 中实现
- [ ] 修复状态：已完成 / 进行中 / 需要讨论
- [ ] 问题或疑虑：（描述）

---

## Finding Statistics (for Reviewer)

审查多个发现时，跟踪：

- **发现的问题总数：** X
- **Critical：** X
- **High：** X
- **Medium：** X
- **Low：** X

**建议：** ✅ 批准 / ⚠️ 请求更改 / 🔄 需要讨论

**整体代码质量：** 1-5 星
